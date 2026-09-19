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
    $stmt = $db->prepare("INSERT INTO projects (id, name, admin_id, menu) VALUES (?, ?, ?, ?)");
    $stmt->execute([$id, $name, $adminId, json_encode($menu)]);

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

jsonResponse(['error' => 'Invalid action.'], 400);
