<?php
require_once __DIR__ . '/db.php';

$action = $_GET['action'] ?? '';
$db = getDB();

if ($action === 'list') {
    $projectId = $_GET['project_id'] ?? '';
    if (!$projectId) jsonResponse(['error' => 'Project ID required.'], 400);

    $stmt = $db->prepare("
        SELECT c.id, c.project_id, c.user_id, c.text, c.time, c.created_at,
               u.name as user_name, u.photo as user_photo
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.project_id = ?
        ORDER BY c.time DESC
    ");
    $stmt->execute([$projectId]);
    jsonResponse(['comments' => $stmt->fetchAll()]);
}

if ($action === 'create') {
    $data = getBody();
    $projectId = $data['project_id'] ?? '';
    $userId = $data['user_id'] ?? '';
    $text = trim($data['text'] ?? '');

    if (!$projectId || !$userId || !$text) {
        jsonResponse(['error' => 'Project ID, User ID, and comment text required.'], 400);
    }

    $id = (string)time() . substr(md5(uniqid()), 0, 5);
    $time = time() * 1000;

    $stmt = $db->prepare("INSERT INTO comments (id, project_id, user_id, text, time) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$id, $projectId, $userId, $text, $time]);

    jsonResponse(['success' => true, 'message' => 'Comment sent!', 'id' => $id]);
}

if ($action === 'delete') {
    $data = getBody();
    $id = $data['id'] ?? '';
    if (!$id) jsonResponse(['error' => 'Comment ID required.'], 400);

    $stmt = $db->prepare("DELETE FROM comments WHERE id = ?");
    $stmt->execute([$id]);

    jsonResponse(['success' => true, 'message' => 'Comment deleted.']);
}

jsonResponse(['error' => 'Invalid action.'], 400);
