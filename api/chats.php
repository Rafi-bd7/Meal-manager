<?php
require_once __DIR__ . '/db.php';

$action = $_GET['action'] ?? '';
$db = getDB();

// ── Ensure online_status & typing columns exist ─────────────────────────────
try {
    $db->exec("CREATE TABLE IF NOT EXISTS `chat_presence` (
        `user_id` VARCHAR(64) PRIMARY KEY,
        `project_id` VARCHAR(64) NOT NULL,
        `last_seen` BIGINT NOT NULL DEFAULT 0,
        `is_typing` TINYINT(1) NOT NULL DEFAULT 0,
        `typing_time` BIGINT NOT NULL DEFAULT 0,
        INDEX (`project_id`)
    ) ENGINE=InnoDB");
} catch (Exception $e) {}

// ── List Messages ────────────────────────────────────────────────────────────
if ($action === 'list') {
    $projectId = $_GET['project_id'] ?? '';
    if (!$projectId) jsonResponse(['error' => 'Project ID required.'], 400);

    $afterTime = intval($_GET['after'] ?? 0);
    if ($afterTime > 0) {
        $stmt = $db->prepare("SELECT c.id, c.project_id as projectId, c.user_id as userId,
                                     c.user_name as userName, c.text, c.image, c.time,
                                     c.reply_to as replyTo, c.reply_text as replyText,
                                     c.reactions,
                                     u.photo as userPhoto
                              FROM chats c
                              LEFT JOIN users u ON c.user_id = u.id
                              WHERE c.project_id = ? AND c.time > ?
                              ORDER BY c.time ASC LIMIT 150");
        $stmt->execute([$projectId, $afterTime]);
    } else {
        $stmt = $db->prepare("SELECT c.id, c.project_id as projectId, c.user_id as userId,
                                     c.user_name as userName, c.text, c.image, c.time,
                                     c.reply_to as replyTo, c.reply_text as replyText,
                                     c.reactions,
                                     u.photo as userPhoto
                              FROM chats c
                              LEFT JOIN users u ON c.user_id = u.id
                              WHERE c.project_id = ?
                              ORDER BY c.time ASC LIMIT 300");
        $stmt->execute([$projectId]);
    }

    $chats = $stmt->fetchAll();
    foreach ($chats as &$c) {
        $c['reactions'] = !empty($c['reactions']) ? json_decode($c['reactions'], true) : [];
    }

    // Also get who's online (last seen within 30 seconds)
    $onlineThreshold = (time() * 1000) - 30000;
    $presStmt = $db->prepare("SELECT user_id as userId, last_seen as lastSeen, is_typing as isTyping, typing_time as typingTime
                               FROM chat_presence WHERE project_id = ? AND last_seen > ?");
    $presStmt->execute([$projectId, $onlineThreshold]);
    $presence = $presStmt->fetchAll();

    jsonResponse(['chats' => $chats, 'presence' => $presence]);
}

// ── Send Message ─────────────────────────────────────────────────────────────
if ($action === 'send') {
    $data = getBody();
    $projectId = $data['project_id'] ?? '';
    $userId = $data['user_id'] ?? '';
    $userName = $data['user_name'] ?? 'Anonymous';
    $text = trim($data['text'] ?? '');
    $image = $data['image'] ?? null;
    $replyTo = $data['reply_to'] ?? null;
    $replyText = $data['reply_text'] ?? null;

    if (!$projectId || !$userId || ($text === '' && empty($image))) {
        jsonResponse(['error' => 'Project ID, User ID, and message text or image are required.'], 400);
    }

    // Ensure reply columns exist
    try {
        $db->exec("ALTER TABLE `chats` ADD COLUMN IF NOT EXISTS `reply_to` VARCHAR(64) NULL");
        $db->exec("ALTER TABLE `chats` ADD COLUMN IF NOT EXISTS `reply_text` TEXT NULL");
        $db->exec("ALTER TABLE `chats` ADD COLUMN IF NOT EXISTS `reactions` TEXT NULL");
    } catch (Exception $e) {}

    $id = (string)time() . substr(md5(uniqid()), 0, 5);
    $time = !empty($data['time']) ? intval($data['time']) : (time() * 1000);

    $stmt = $db->prepare("INSERT INTO chats (id, project_id, user_id, user_name, text, image, time, reply_to, reply_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$id, $projectId, $userId, $userName, $text, $image, $time, $replyTo, $replyText]);

    // Update presence (mark not typing after sending)
    $db->prepare("INSERT INTO chat_presence (user_id, project_id, last_seen, is_typing, typing_time)
                  VALUES (?, ?, ?, 0, 0)
                  ON DUPLICATE KEY UPDATE last_seen = VALUES(last_seen), is_typing = 0, typing_time = 0")
       ->execute([$userId, $projectId, $time]);

    jsonResponse(['success' => true, 'id' => $id, 'time' => $time, 'image' => $image ? true : false]);
}

// ── Delete Message ────────────────────────────────────────────────────────────
if ($action === 'delete') {
    $data = getBody();
    $id = $data['id'] ?? '';
    if (!$id) jsonResponse(['error' => 'Message ID required.'], 400);

    $stmt = $db->prepare("DELETE FROM chats WHERE id = ?");
    $stmt->execute([$id]);

    jsonResponse(['success' => true, 'message' => 'Message deleted successfully.']);
}

// ── Clear All Messages ────────────────────────────────────────────────────────
if ($action === 'clear') {
    $data = getBody();
    $projectId = $data['project_id'] ?? '';
    if (!$projectId) jsonResponse(['error' => 'Project ID required.'], 400);

    $stmt = $db->prepare("DELETE FROM chats WHERE project_id = ?");
    $stmt->execute([$projectId]);

    jsonResponse(['success' => true, 'message' => 'All chats cleared.']);
}

// ── Typing Indicator ─────────────────────────────────────────────────────────
if ($action === 'typing') {
    $data = getBody();
    $userId = $data['user_id'] ?? '';
    $projectId = $data['project_id'] ?? '';
    $isTyping = !empty($data['is_typing']) ? 1 : 0;

    if (!$userId || !$projectId) jsonResponse(['error' => 'Missing fields'], 400);

    $now = time() * 1000;
    $db->prepare("INSERT INTO chat_presence (user_id, project_id, last_seen, is_typing, typing_time)
                  VALUES (?, ?, ?, ?, ?)
                  ON DUPLICATE KEY UPDATE last_seen = VALUES(last_seen), is_typing = VALUES(is_typing), typing_time = VALUES(typing_time)")
       ->execute([$userId, $projectId, $now, $isTyping, $isTyping ? $now : 0]);

    jsonResponse(['success' => true]);
}

// ── Presence / Heartbeat ─────────────────────────────────────────────────────
if ($action === 'heartbeat') {
    $data = getBody();
    $userId = $data['user_id'] ?? '';
    $projectId = $data['project_id'] ?? '';
    if (!$userId || !$projectId) jsonResponse(['error' => 'Missing fields'], 400);

    $now = time() * 1000;
    $db->prepare("INSERT INTO chat_presence (user_id, project_id, last_seen, is_typing, typing_time)
                  VALUES (?, ?, ?, 0, 0)
                  ON DUPLICATE KEY UPDATE last_seen = VALUES(last_seen)")
       ->execute([$userId, $projectId, $now]);

    jsonResponse(['success' => true, 'time' => $now]);
}

// ── React to Message ─────────────────────────────────────────────────────────
if ($action === 'react') {
    $data = getBody();
    $msgId = $data['id'] ?? '';
    $userId = $data['user_id'] ?? '';
    $emoji = $data['emoji'] ?? '';

    if (!$msgId || !$userId || !$emoji) jsonResponse(['error' => 'Missing fields'], 400);

    // Ensure reactions column exists
    try { $db->exec("ALTER TABLE `chats` ADD COLUMN IF NOT EXISTS `reactions` TEXT NULL"); } catch (Exception $e) {}

    $stmt = $db->prepare("SELECT reactions FROM chats WHERE id = ?");
    $stmt->execute([$msgId]);
    $row = $stmt->fetch();
    if (!$row) jsonResponse(['error' => 'Message not found'], 404);

    $reactions = !empty($row['reactions']) ? json_decode($row['reactions'], true) : [];
    if (!isset($reactions[$emoji])) $reactions[$emoji] = [];

    // Toggle: if user already reacted with this emoji, remove it
    $idx = array_search($userId, $reactions[$emoji]);
    if ($idx !== false) {
        array_splice($reactions[$emoji], $idx, 1);
        if (empty($reactions[$emoji])) unset($reactions[$emoji]);
    } else {
        $reactions[$emoji][] = $userId;
    }

    $db->prepare("UPDATE chats SET reactions = ? WHERE id = ?")
       ->execute([json_encode($reactions, JSON_UNESCAPED_UNICODE), $msgId]);

    jsonResponse(['success' => true, 'reactions' => $reactions]);
}

// ── Mark Seen ─────────────────────────────────────────────────────────────────
if ($action === 'seen') {
    $data = getBody();
    $userId = $data['user_id'] ?? '';
    $projectId = $data['project_id'] ?? '';
    $lastMsgTime = intval($data['last_time'] ?? 0);

    if (!$userId || !$projectId) jsonResponse(['error' => 'Missing fields'], 400);

    try {
        $db->exec("ALTER TABLE `chat_presence` ADD COLUMN IF NOT EXISTS `last_read_time` BIGINT NOT NULL DEFAULT 0");
    } catch (Exception $e) {}

    $now = time() * 1000;
    $db->prepare("INSERT INTO chat_presence (user_id, project_id, last_seen, is_typing, typing_time, last_read_time)
                  VALUES (?, ?, ?, 0, 0, ?)
                  ON DUPLICATE KEY UPDATE last_seen = VALUES(last_seen), last_read_time = VALUES(last_read_time)")
       ->execute([$userId, $projectId, $now, $lastMsgTime]);

    jsonResponse(['success' => true]);
}

jsonResponse(['error' => 'Invalid action.'], 400);
