<?php
require_once __DIR__ . '/db.php';

$action = $_GET['action'] ?? '';
$db = getDB();

if ($action === 'list') {
    $projectId = $_GET['project_id'] ?? '';
    if (!$projectId) jsonResponse(['error' => 'Project ID required.'], 400);

    $afterTime = intval($_GET['after'] ?? 0);
    if ($afterTime > 0) {
        $stmt = $db->prepare("SELECT c.id, c.project_id as projectId, c.user_id as userId,
                                     c.user_name as userName, c.text, c.image, c.time,
                                     u.photo as userPhoto
                              FROM chats c
                              LEFT JOIN users u ON c.user_id = u.id
                              WHERE c.project_id = ? AND c.time > ?
                              ORDER BY c.time ASC LIMIT 150");
        $stmt->execute([$projectId, $afterTime]);
    } else {
        $stmt = $db->prepare("SELECT c.id, c.project_id as projectId, c.user_id as userId,
                                     c.user_name as userName, c.text, c.image, c.time,
                                     u.photo as userPhoto
                              FROM chats c
                              LEFT JOIN users u ON c.user_id = u.id
                              WHERE c.project_id = ?
                              ORDER BY c.time ASC LIMIT 300");
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
    $image = $data['image'] ?? null;

    if (!$projectId || !$userId || ($text === '' && empty($image))) {
        jsonResponse(['error' => 'Project ID, User ID, and message text or image are required.'], 400);
    }

    $id = (string)time() . substr(md5(uniqid()), 0, 5);
    $time = !empty($data['time']) ? intval($data['time']) : (time() * 1000);

    $stmt = $db->prepare("INSERT INTO chats (id, project_id, user_id, user_name, text, image, time) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$id, $projectId, $userId, $userName, $text, $image, $time]);

    jsonResponse(['success' => true, 'id' => $id, 'time' => $time, 'image' => $image ? true : false]);
}

if ($action === 'delete') {
    $data = getBody();
    $id = $data['id'] ?? '';
    if (!$id) jsonResponse(['error' => 'Message ID required.'], 400);

    $stmt = $db->prepare("DELETE FROM chats WHERE id = ?");
    $stmt->execute([$id]);

    jsonResponse(['success' => true, 'message' => 'Message deleted successfully.']);
}

if ($action === 'clear') {
    $data = getBody();
    $projectId = $data['project_id'] ?? '';
    if (!$projectId) jsonResponse(['error' => 'Project ID required.'], 400);

    $stmt = $db->prepare("DELETE FROM chats WHERE project_id = ?");
    $stmt->execute([$projectId]);

    jsonResponse(['success' => true, 'message' => 'All chats cleared.']);
}

jsonResponse(['error' => 'Invalid action.'], 400);
