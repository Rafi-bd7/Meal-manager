<?php
require_once __DIR__ . '/db.php';

$action = $_GET['action'] ?? '';
$db = getDB();

if ($action === 'list') {
    $projectId = $_GET['project_id'] ?? '';
    if (!$projectId) jsonResponse(['error' => 'Project ID required.'], 400);

    $date = $_GET['date'] ?? '';
    $userId = $_GET['user_id'] ?? '';

    $query = "SELECT id, project_id, user_id, date, breakfast, lunch, dinner FROM meal_records WHERE project_id = ?";
    $params = [$projectId];

    if ($date) {
        $query .= " AND date = ?";
        $params[] = $date;
    }
    if ($userId) {
        $query .= " AND user_id = ?";
        $params[] = $userId;
    }

    $stmt = $db->prepare($query);
    $stmt->execute($params);
    $records = $stmt->fetchAll();
    
    // Ensure booleans are typed properly
    foreach ($records as &$r) {
        $r['breakfast'] = (bool)$r['breakfast'];
        $r['lunch'] = (bool)$r['lunch'];
        $r['dinner'] = (bool)$r['dinner'];
    }

    jsonResponse(['records' => $records]);
}

if ($action === 'save') {
    $data = getBody();
    $projectId = $data['project_id'] ?? '';
    $userId = $data['user_id'] ?? '';
    $date = $data['date'] ?? '';
    $b = !empty($data['breakfast']) ? 1 : 0;
    $l = !empty($data['lunch']) ? 1 : 0;
    $d = !empty($data['dinner']) ? 1 : 0;

    if (!$projectId || !$userId || !$date) {
        jsonResponse(['error' => 'Project ID, User ID, and date are required.'], 400);
    }

    $id = "{$projectId}_{$userId}_{$date}";
    $stmt = $db->prepare("
        INSERT INTO meal_records (id, project_id, user_id, date, breakfast, lunch, dinner)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE breakfast = VALUES(breakfast), lunch = VALUES(lunch), dinner = VALUES(dinner)
    ");
    $stmt->execute([$id, $projectId, $userId, $date, $b, $l, $d]);

    // Add notification if saved by user
    if (!empty($data['sender_name'])) {
        $notifId = (string)time() . substr(md5(uniqid()), 0, 5);
        $msg = "{$data['sender_name']} updated their meal for {$date}.";
        $nStmt = $db->prepare("INSERT INTO notifications (id, project_id, to_user, message, time) VALUES (?, ?, 'admin', ?, ?)");
        $nStmt->execute([$notifId, $projectId, $msg, time() * 1000]);
    }

    jsonResponse(['success' => true, 'message' => 'Meal saved successfully!']);
}

if ($action === 'toggle') {
    $data = getBody();
    $projectId = $data['project_id'] ?? '';
    $userId = $data['user_id'] ?? '';
    $date = $data['date'] ?? '';
    $type = $data['type'] ?? '';

    if (!in_array($type, ['breakfast', 'lunch', 'dinner'])) {
        jsonResponse(['error' => 'Invalid meal type.'], 400);
    }

    $id = "{$projectId}_{$userId}_{$date}";
    $stmt = $db->prepare("SELECT breakfast, lunch, dinner FROM meal_records WHERE id = ?");
    $stmt->execute([$id]);
    $existing = $stmt->fetch();

    $b = $existing ? (int)$existing['breakfast'] : 0;
    $l = $existing ? (int)$existing['lunch'] : 0;
    $d = $existing ? (int)$existing['dinner'] : 0;

    if ($type === 'breakfast') $b = $b ? 0 : 1;
    if ($type === 'lunch') $l = $l ? 0 : 1;
    if ($type === 'dinner') $d = $d ? 0 : 1;

    $stmt = $db->prepare("
        INSERT INTO meal_records (id, project_id, user_id, date, breakfast, lunch, dinner)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE breakfast = VALUES(breakfast), lunch = VALUES(lunch), dinner = VALUES(dinner)
    ");
    $stmt->execute([$id, $projectId, $userId, $date, $b, $l, $d]);

    // Send notification to member
    $notifId = (string)time() . substr(md5(uniqid()), 0, 5);
    $msg = "Admin updated your meal for {$date}.";
    $nStmt = $db->prepare("INSERT INTO notifications (id, project_id, to_user, message, time) VALUES (?, ?, ?, ?, ?)");
    $nStmt->execute([$notifId, $projectId, $userId, $msg, time() * 1000]);

    jsonResponse(['success' => true, 'message' => 'Meal updated!']);
}

jsonResponse(['error' => 'Invalid action.'], 400);
