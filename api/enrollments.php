<?php
require_once __DIR__ . '/db.php';

$action = $_GET['action'] ?? '';
$db = getDB();

if ($action === 'list') {
    $projectId = $_GET['project_id'] ?? '';
    if ($projectId) {
        $stmt = $db->prepare("
            SELECT e.id, e.project_id, e.user_id, e.status, e.money_given, e.created_at,
                   u.name, u.email, u.role, u.photo
            FROM enrollments e
            JOIN users u ON e.user_id = u.id
            WHERE e.project_id = ?
            ORDER BY u.name ASC
        ");
        $stmt->execute([$projectId]);
    } else {
        $stmt = $db->query("
            SELECT e.id, e.project_id, e.user_id, e.status, e.money_given, e.created_at,
                   u.name, u.email, u.role, u.photo
            FROM enrollments e
            JOIN users u ON e.user_id = u.id
            ORDER BY e.created_at DESC
        ");
    }
    jsonResponse(['enrollments' => $stmt->fetchAll()]);
}

if ($action === 'user_enrollments') {
    $userId = $_GET['user_id'] ?? '';
    if (!$userId) jsonResponse(['error' => 'User ID required.'], 400);

    $stmt = $db->prepare("
        SELECT e.id, e.project_id, e.user_id, e.status, e.money_given,
               p.name as project_name, p.admin_id, p.menu
        FROM enrollments e
        JOIN projects p ON e.project_id = p.id
        WHERE e.user_id = ?
        ORDER BY e.created_at DESC
    ");
    $stmt->execute([$userId]);
    $list = $stmt->fetchAll();
    foreach ($list as &$item) {
        $item['menu'] = !empty($item['menu']) ? json_decode($item['menu'], true) : null;
    }
    jsonResponse(['enrollments' => $list]);
}

if ($action === 'request_join') {
    $data = getBody();
    $projectId = $data['project_id'] ?? '';
    $userId = $data['user_id'] ?? '';

    if (!$projectId || !$userId) {
        jsonResponse(['error' => 'Project ID and User ID are required.'], 400);
    }

    $id = "{$projectId}_{$userId}";
    // Check if already exists
    $stmt = $db->prepare("SELECT status FROM enrollments WHERE project_id = ? AND user_id = ?");
    $stmt->execute([$projectId, $userId]);
    $existing = $stmt->fetch();

    if ($existing) {
        jsonResponse(['error' => "You already requested or enrolled with status: {$existing['status']}."], 409);
    }

    $stmt = $db->prepare("INSERT INTO enrollments (id, project_id, user_id, status, money_given) VALUES (?, ?, ?, 'pending', 0.00)");
    $stmt->execute([$id, $projectId, $userId]);

    jsonResponse(['success' => true, 'message' => 'Join request sent to admin!']);
}

if ($action === 'approve') {
    $data = getBody();
    $projectId = $data['project_id'] ?? '';
    $userId = $data['user_id'] ?? '';

    if (!$projectId || !$userId) jsonResponse(['error' => 'Project ID and User ID required.'], 400);

    $stmt = $db->prepare("UPDATE enrollments SET status = 'approved' WHERE project_id = ? AND user_id = ?");
    $stmt->execute([$projectId, $userId]);

    jsonResponse(['success' => true, 'message' => 'Member approved!']);
}

if ($action === 'update_deposit') {
    $data = getBody();
    $projectId = $data['project_id'] ?? '';
    $userId = $data['user_id'] ?? '';
    $moneyGiven = floatval($data['money_given'] ?? 0);

    if (!$projectId || !$userId) jsonResponse(['error' => 'Project ID and User ID required.'], 400);

    $id = $projectId . '_' . $userId;
    $stmt = $db->prepare("INSERT INTO enrollments (id, project_id, user_id, status, money_given) 
                          VALUES (?, ?, ?, 'approved', ?) 
                          ON DUPLICATE KEY UPDATE money_given = VALUES(money_given)");
    $stmt->execute([$id, $projectId, $userId, $moneyGiven]);

    jsonResponse(['success' => true, 'message' => 'Deposit updated successfully!']);
}

if ($action === 'remove') {
    $data = getBody();
    $projectId = $data['project_id'] ?? '';
    $userId = $data['user_id'] ?? '';

    if (!$projectId || !$userId) jsonResponse(['error' => 'Project ID and User ID required.'], 400);

    $stmt = $db->prepare("DELETE FROM enrollments WHERE project_id = ? AND user_id = ?");
    $stmt->execute([$projectId, $userId]);

    jsonResponse(['success' => true, 'message' => 'Member removed from project.']);
}

jsonResponse(['error' => 'Invalid action.'], 400);
