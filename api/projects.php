<?php
require_once __DIR__ . '/db.php';

$action = $_GET['action'] ?? '';
$db = getDB();

if ($action === 'list') {
    $stmt = $db->query("SELECT id, name, admin_id, menu, created_at FROM projects ORDER BY created_at DESC");
    $projects = $stmt->fetchAll();
    foreach ($projects as &$p) {
        if (!empty($p['menu'])) {
            $p['menu'] = json_decode($p['menu'], true);
        } else {
            $days = ['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday'];
            $menu = [];
            foreach ($days as $d) $menu[$d] = ['b'=>'', 'l'=>'', 'd'=>''];
            $p['menu'] = $menu;
        }
    }
    jsonResponse(['projects' => $projects]);
}

if ($action === 'create') {
    $data = getBody();
    $name = trim($data['name'] ?? '');
    $adminId = $data['admin_id'] ?? '';

    if (!$name || !$adminId) {
        jsonResponse(['error' => 'Project name and Admin ID are required.'], 400);
    }

    // Check duplicate name
    $stmt = $db->prepare("SELECT id FROM projects WHERE LOWER(name) = LOWER(?)");
    $stmt->execute([$name]);
    if ($stmt->fetch()) {
        jsonResponse(['error' => 'Project with this name already exists!'], 409);
    }

    $days = ['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday'];
    $menu = [];
    foreach ($days as $d) $menu[$d] = ['b'=>'', 'l'=>'', 'd'=>''];

    $id = (string)time() . substr(md5(uniqid()), 0, 5);
    try {
        $db->exec("ALTER TABLE `projects` ADD COLUMN IF NOT EXISTS `creator_id` VARCHAR(64) NULL");
    } catch (Exception $e) {}
    $stmt = $db->prepare("INSERT INTO projects (id, name, admin_id, creator_id, menu) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$id, $name, $adminId, $adminId, json_encode($menu)]);

    // Auto-enroll admin as an approved member so they are counted in bills & finances
    $enrollId = $id . '_' . $adminId;
    $enrollStmt = $db->prepare("INSERT IGNORE INTO enrollments (id, project_id, user_id, status, money_given) VALUES (?, ?, ?, 'approved', 0.00)");
    $enrollStmt->execute([$enrollId, $id, $adminId]);

    jsonResponse([
        'success' => true,
        'message' => 'Project created successfully!',
        'project' => ['id' => $id, 'name' => $name, 'admin_id' => $adminId, 'menu' => $menu]
    ], 201);
}

if ($action === 'update_menu') {
    $data = getBody();
    $projectId = $data['project_id'] ?? '';
    $menu = $data['menu'] ?? null;

    if (!$projectId || !$menu) {
        jsonResponse(['error' => 'Project ID and menu data required.'], 400);
    }

    $stmt = $db->prepare("UPDATE projects SET menu = ? WHERE id = ?");
    $stmt->execute([json_encode($menu), $projectId]);

    jsonResponse(['success' => true, 'message' => 'Weekly menu updated!']);
}

if ($action === 'delete') {
    $data = getBody();
    $projectId = $data['project_id'] ?? '';
    if (!$projectId) jsonResponse(['error' => 'Project ID required.'], 400);

    $db->prepare("DELETE FROM projects WHERE id = ?")->execute([$projectId]);
    $db->prepare("DELETE FROM enrollments WHERE project_id = ?")->execute([$projectId]);
    $db->prepare("DELETE FROM meal_records WHERE project_id = ?")->execute([$projectId]);
    $db->prepare("DELETE FROM comments WHERE project_id = ?")->execute([$projectId]);
    $db->prepare("DELETE FROM chats WHERE project_id = ?")->execute([$projectId]);
    $db->prepare("DELETE FROM notifications WHERE project_id = ?")->execute([$projectId]);

    jsonResponse(['success' => true, 'message' => 'Project deleted successfully.']);
}

if ($action === 'handover_manager') {
    $data = getBody();
    $projectId = $data['project_id'] ?? '';
    $currentAdminId = $data['current_admin_id'] ?? '';
    $newAdminId = $data['new_admin_id'] ?? '';
    $demoteSelf = !empty($data['demote_self']);

    if (!$projectId || !$currentAdminId || !$newAdminId) {
        jsonResponse(['error' => 'Project ID, Current Admin ID, and New Admin ID are required.'], 400);
    }

    if ($currentAdminId === $newAdminId) {
        jsonResponse(['error' => 'নতুন ম্যানেজার হিসেবে অন্য কোনো সক্রিয় মেম্বারকে নির্বাচন করুন।'], 400);
    }

    // Verify project exists
    $stmt = $db->prepare("SELECT id, name, admin_id FROM projects WHERE id = ?");
    $stmt->execute([$projectId]);
    $project = $stmt->fetch();
    if (!$project) {
        jsonResponse(['error' => 'প্রজেক্ট পাওয়া যায়নি।'], 404);
    }

    // Verify current admin (either creator/admin_id of project or has admin role)
    $cStmt = $db->prepare("SELECT id, name, role FROM users WHERE id = ?");
    $cStmt->execute([$currentAdminId]);
    $currUser = $cStmt->fetch();
    $isAuthorized = ($currUser && $currUser['role'] === 'admin') || (string)($project['admin_id'] ?? '') === (string)$currentAdminId;
    if (!$isAuthorized) {
        jsonResponse(['error' => 'শুধুমাত্র বর্তমান প্রজেক্ট ম্যানেজারই দায়িত্ব হস্তান্তর বা নতুন অ্যাডমিন যোগ করতে পারবেন।'], 403);
    }
    $currAdminName = $currUser ? $currUser['name'] : 'বর্তমান ম্যানেজার';

    // Verify new admin is an approved member of this project
    $stmt = $db->prepare("SELECT u.id, u.name, u.email FROM enrollments e JOIN users u ON e.user_id = u.id WHERE e.project_id = ? AND e.user_id = ? AND e.status = 'approved'");
    $stmt->execute([$projectId, $newAdminId]);
    $newAdminUser = $stmt->fetch();
    if (!$newAdminUser) {
        jsonResponse(['error' => 'নির্বাচিত সদস্য এই প্রজেক্টের অনুমোদিত মেম্বার নন।'], 400);
    }

    // 1. Promote new admin user role to admin
    $uRole = $db->prepare("UPDATE users SET role = 'admin' WHERE id = ?");
    $uRole->execute([$newAdminId]);

    // 2. Handle handover vs co-admin mode
    if ($demoteSelf) {
        // Full handover: update project primary admin_id & demote current admin to regular user
        $uProj = $db->prepare("UPDATE projects SET admin_id = ? WHERE id = ?");
        $uProj->execute([$newAdminId, $projectId]);

        $uOld = $db->prepare("UPDATE users SET role = 'user' WHERE id = ?");
        $uOld->execute([$currentAdminId]);

        $chatMsg = "👑 মেসের ম্যানেজার সম্পূর্ণ হস্তান্তর হয়েছে! {$currAdminName} মেসের নতুন ম্যানেজার হিসেবে {$newAdminUser['name']} কে দায়িত্ব হস্তান্তর করেছেন।";
        $successMsg = "ম্যানেজার সম্পূর্ণ হস্তান্তর সফল হয়েছে! নতুন ম্যানেজার: {$newAdminUser['name']}";
    } else {
        // Co-admin mode: keep current admin, add new admin as co-manager
        $chatMsg = "👑 নতুন সহ-ম্যানেজার (Co-Admin) যুক্ত হয়েছেন! {$currAdminName} মেসের নতুন সহ-ম্যানেজার হিসেবে {$newAdminUser['name']} কে যুক্ত করেছেন। এখন থেকে উভয়েই অ্যাডমিন হিসেবে মেস পরিচালনা করবেন।";
        $successMsg = "সহ-ম্যানেজার সফলভাবে যুক্ত হয়েছে! {$newAdminUser['name']} এখন আপনার সাথে মেসের সহ-অ্যাডমিন।";
    }

    // 3. Send system announcement in chats
    $chatId = 'c_' . time() . substr(md5(uniqid()), 0, 4);
    $cChat = $db->prepare("INSERT INTO chats (id, project_id, user_id, user_name, text, time) VALUES (?, ?, ?, 'System', ?, ?)");
    $cChat->execute([$chatId, $projectId, $currentAdminId, $chatMsg, time() * 1000]);

    // 4. Send notification to all project members
    $notifId = (string)time() . substr(md5(uniqid()), 0, 5);
    $nStmt = $db->prepare("INSERT INTO notifications (id, project_id, to_user, message, time) VALUES (?, ?, 'all', ?, ?)");
    $nStmt->execute([$notifId, $projectId, $chatMsg, time() * 1000]);

    jsonResponse([
        'success' => true,
        'message' => $successMsg,
        'new_admin' => $newAdminUser,
        'demoted' => $demoteSelf
    ]);
}

if ($action === 'remove_coadmin' || $action === 'demote_coadmin') {
    $data = getBody();
    $projectId = $data['project_id'] ?? '';
    $currentAdminId = $data['current_admin_id'] ?? '';
    $targetUserId = $data['target_user_id'] ?? '';

    if (!$projectId || !$currentAdminId || !$targetUserId) {
        jsonResponse(['error' => 'Project ID, Current Admin ID, and Target User ID are required.'], 400);
    }

    // Verify project exists
    $stmt = $db->prepare("SELECT id, name, admin_id, creator_id FROM projects WHERE id = ?");
    $stmt->execute([$projectId]);
    $project = $stmt->fetch();
    if (!$project) {
        jsonResponse(['error' => 'প্রজেক্ট পাওয়া যায়নি।'], 404);
    }

    // Verify current admin authority
    $cStmt = $db->prepare("SELECT id, name, role FROM users WHERE id = ?");
    $cStmt->execute([$currentAdminId]);
    $currUser = $cStmt->fetch();
    $isAuthorized = ($currUser && $currUser['role'] === 'admin') || (string)($project['admin_id'] ?? '') === (string)$currentAdminId || (string)($project['creator_id'] ?? '') === (string)$currentAdminId;
    if (!$isAuthorized) {
        jsonResponse(['error' => 'শুধুমাত্র প্রজেক্ট অ্যাডমিনই সহ-অ্যাডমিন পদ বাতিল করতে পারবেন।'], 403);
    }

    // Cannot demote primary creator/owner of project
    if ((string)($project['admin_id'] ?? '') === (string)$targetUserId || (string)($project['creator_id'] ?? '') === (string)$targetUserId) {
        jsonResponse(['error' => 'মেসের মূল প্রতিষ্ঠাতা/প্রধান ম্যানেজারের পদ বাতিল করা সম্ভব নয়।'], 400);
    }

    // Fetch target user info
    $tStmt = $db->prepare("SELECT id, name, email FROM users WHERE id = ?");
    $tStmt->execute([$targetUserId]);
    $targetUser = $tStmt->fetch();
    if (!$targetUser) {
        jsonResponse(['error' => 'টার্গেট ব্যবহারকারী পাওয়া যায়নি।'], 404);
    }

    // Demote target user role to 'user'
    $uStmt = $db->prepare("UPDATE users SET role = 'user' WHERE id = ?");
    $uStmt->execute([$targetUserId]);

    $currAdminName = $currUser ? $currUser['name'] : 'ম্যানেজার';
    $targetName = $targetUser['name'];
    $chatMsg = "👑 সহ-ম্যানেজার পদ প্রত্যাহার: {$currAdminName} মেসের সহ-অ্যাডমিন হিসেবে {$targetName}-এর দায়িত্ব প্রত্যাহার করেছেন এবং তাকে সাধারণ মেম্বার হিসেবে নির্ধারণ করেছেন।";

    // Send announcement to chats
    $chatId = 'c_' . time() . substr(md5(uniqid()), 0, 4);
    $cChat = $db->prepare("INSERT INTO chats (id, project_id, user_id, user_name, text, time) VALUES (?, ?, ?, 'System', ?, ?)");
    $cChat->execute([$chatId, $projectId, $currentAdminId, $chatMsg, time() * 1000]);

    // Send notification to all members
    $notifId = (string)time() . substr(md5(uniqid()), 0, 5);
    $nStmt = $db->prepare("INSERT INTO notifications (id, project_id, to_user, message, time) VALUES (?, ?, 'all', ?, ?)");
    $nStmt->execute([$notifId, $projectId, $chatMsg, time() * 1000]);

    jsonResponse([
        'success' => true,
        'message' => "{$targetName}-এর সহ-অ্যাডমিন পদ বাতিল করা হয়েছে এবং তিনি এখন সাধারণ মেম্বার।"
    ]);
}

jsonResponse(['error' => 'Invalid action.'], 400);

