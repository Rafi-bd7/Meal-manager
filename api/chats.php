<?php
require_once __DIR__ . '/db.php';

$action = $_GET['action'] ?? '';
$db = getDB();

if ($action === 'list') {
    $projectId = $_GET['project_id'] ?? '';
    if (!$projectId) jsonResponse(['error' => 'Project ID required.'], 400);

    $afterTime = intval($_GET['after'] ?? 0);
    if ($afterTime > 0) {
        $stmt = $db->prepare("SELECT id, project_id, user_id, user_name, text, time FROM chats WHERE project_id = ? AND time > ? ORDER BY time ASC LIMIT 100");
        $stmt->execute([$projectId, $afterTime]);
    } else {
        $stmt = $db->prepare("SELECT id, project_id, user_id, user_name, text, time FROM chats WHERE project_id = ? ORDER BY time ASC LIMIT 200");
        $stmt->execute([$projectId]);
    }

    jsonResponse(['chats' => $stmt->fetchAll()]);
}

if ($action === 'send') {
    $data = getBody();
    $projectId = $data['project_id'] ?? '';
    $userId = $data['user_id'] ?? '';
    $userName = $data['user_name'] ?? 'Anonymous';
    $text = trim($data['text'] ?? '');

    if (!$projectId || !$userId || !$text) {
        jsonResponse(['error' => 'Project ID, User ID, and text are required.'], 400);
    }

    $id = (string)time() . substr(md5(uniqid()), 0, 5);
    $time = !empty($data['time']) ? intval($data['time']) : (time() * 1000);

    $stmt = $db->prepare("INSERT INTO chats (id, project_id, user_id, user_name, text, time) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([$id, $projectId, $userId, $userName, $text, $time]);

    jsonResponse(['success' => true, 'id' => $id, 'time' => $time]);
}

jsonResponse(['error' => 'Invalid action.'], 400);
