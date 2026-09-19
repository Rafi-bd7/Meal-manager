<?php
require_once __DIR__ . '/db.php';

$action = $_GET['action'] ?? '';
$db = getDB();

// Ensure reply columns exist
try {
    $db->exec("ALTER TABLE `comments` ADD COLUMN IF NOT EXISTS `reply` TEXT NULL");
    $db->exec("ALTER TABLE `comments` ADD COLUMN IF NOT EXISTS `reply_time` BIGINT NULL");
} catch (Exception $e) {}

if ($action === 'list') {
    $projectId = $_GET['project_id'] ?? '';
    if (!$projectId) jsonResponse(['error' => 'Project ID required.'], 400);

    $stmt = $db->prepare("
        SELECT c.id, c.project_id as projectId, c.user_id as userId, c.text, c.time,
               c.reply, c.reply_time as replyTime, c.created_at,
               u.name as userName, u.photo as userPhoto
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
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

    jsonResponse(['success' => true, 'message' => 'Comment sent!', 'id' => $id, 'time' => $time]);
}

if ($action === 'reply') {
    $data = getBody();
    $id = $data['id'] ?? '';
    $reply = trim($data['reply'] ?? '');

    if (!$id || !$reply) {
        jsonResponse(['error' => 'Comment ID and reply text required.'], 400);
    }

    $replyTime = time() * 1000;
    $stmt = $db->prepare("UPDATE comments SET reply = ?, reply_time = ? WHERE id = ?");
    $stmt->execute([$reply, $replyTime, $id]);

    jsonResponse(['success' => true, 'message' => 'Reply sent!', 'id' => $id, 'reply' => $reply, 'reply_time' => $replyTime]);
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

