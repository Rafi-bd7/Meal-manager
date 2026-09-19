<?php
require_once __DIR__ . '/db.php';

$action = $_GET['action'] ?? '';
$db = getDB();

if ($action === 'export') {
    $users = $db->query("SELECT * FROM users")->fetchAll();
    $projects = $db->query("SELECT * FROM projects")->fetchAll();
    foreach ($projects as &$p) {
        $p['menu'] = !empty($p['menu']) ? json_decode($p['menu'], true) : [];
    }
    $enrolls = $db->query("SELECT * FROM enrollments")->fetchAll();
    $records = $db->query("SELECT * FROM meal_records")->fetchAll();
    $comments = $db->query("SELECT * FROM comments")->fetchAll();
    $chats = $db->query("SELECT * FROM chats")->fetchAll();

    jsonResponse([
        'version' => '2.0-mysql',
        'export_time' => date('Y-m-d H:i:s'),
        'meal_users' => $users,
        'meal_projects' => $projects,
        'meal_enrollments' => $enrolls,
        'meal_records' => $records,
        'meal_comments' => $comments,
        'meal_chats' => $chats
    ]);
}

if ($action === 'restore') {
    $data = getBody();
    if (!is_array($data)) {
        jsonResponse(['error' => 'Invalid backup JSON payload.'], 400);
    }

    $db->beginTransaction();
    try {
        if (!empty($data['meal_users'])) {
            $stmt = $db->prepare("INSERT INTO users (id, name, email, password, role, photo) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), password=VALUES(password), role=VALUES(role), photo=VALUES(photo)");
            foreach ($data['meal_users'] as $u) {
                $stmt->execute([$u['id'], $u['name'], strtolower($u['email']), $u['password'], $u['role'] ?? 'user', $u['photo'] ?? null]);
            }
        }

        if (!empty($data['meal_projects'])) {
            $stmt = $db->prepare("INSERT INTO projects (id, name, admin_id, menu) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), menu=VALUES(menu)");
            foreach ($data['meal_projects'] as $p) {
                $menu = is_array($p['menu']) ? json_encode($p['menu']) : ($p['menu'] ?? null);
                $stmt->execute([$p['id'], $p['name'], $p['admin_id'] ?? $p['adminId'] ?? '', $menu]);
            }
        }

        if (!empty($data['meal_enrollments'])) {
            $stmt = $db->prepare("INSERT INTO enrollments (id, project_id, user_id, status, money_given) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status=VALUES(status), money_given=VALUES(money_given)");
            foreach ($data['meal_enrollments'] as $e) {
                $pid = $e['project_id'] ?? $e['projectId'] ?? '';
                $uid = $e['user_id'] ?? $e['userId'] ?? '';
                $id = $e['id'] ?? "{$pid}_{$uid}";
                $status = $e['status'] ?? 'approved';
                $money = floatval($e['money_given'] ?? $e['moneyGiven'] ?? 0);
                $stmt->execute([$id, $pid, $uid, $status, $money]);
            }
        }

        if (!empty($data['meal_records'])) {
            $stmt = $db->prepare("INSERT INTO meal_records (id, project_id, user_id, date, breakfast, lunch, dinner) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE breakfast=VALUES(breakfast), lunch=VALUES(lunch), dinner=VALUES(dinner)");
            foreach ($data['meal_records'] as $r) {
                $pid = $r['project_id'] ?? $r['projectId'] ?? '';
                $uid = $r['user_id'] ?? $r['userId'] ?? '';
                $date = $r['date'] ?? '';
                $id = $r['id'] ?? "{$pid}_{$uid}_{$date}";
                $b = !empty($r['breakfast']) ? 1 : 0;
                $l = !empty($r['lunch']) ? 1 : 0;
                $d = !empty($r['dinner']) ? 1 : 0;
                $stmt->execute([$id, $pid, $uid, $date, $b, $l, $d]);
            }
        }

        if (!empty($data['meal_comments'])) {
            $stmt = $db->prepare("INSERT INTO comments (id, project_id, user_id, text, time) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE text=VALUES(text)");
            foreach ($data['meal_comments'] as $c) {
                $pid = $c['project_id'] ?? $c['projectId'] ?? '';
                $uid = $c['user_id'] ?? $c['userId'] ?? '';
                $id = $c['id'] ?? (string)time();
                $text = $c['text'] ?? '';
                $time = $c['time'] ?? (time() * 1000);
                $stmt->execute([$id, $pid, $uid, $text, $time]);
            }
        }

        if (!empty($data['meal_chats'])) {
            $stmt = $db->prepare("INSERT INTO chats (id, project_id, user_id, user_name, text, time) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE text=VALUES(text)");
            foreach ($data['meal_chats'] as $ch) {
                $pid = $ch['project_id'] ?? $ch['projectId'] ?? '';
                $uid = $ch['user_id'] ?? $ch['userId'] ?? '';
                $uname = $ch['user_name'] ?? $ch['userName'] ?? 'User';
                $id = $ch['id'] ?? (string)time();
                $text = $ch['text'] ?? '';
                $time = $ch['time'] ?? (time() * 1000);
                $stmt->execute([$id, $pid, $uid, $uname, $text, $time]);
            }
        }

        $db->commit();
        jsonResponse(['success' => true, 'message' => 'Data restored successfully to MySQL!']);
    } catch (Exception $e) {
        $db->rollBack();
        jsonResponse(['error' => 'Restore failed: ' . $e->getMessage()], 500);
    }
}

jsonResponse(['error' => 'Invalid action.'], 400);
