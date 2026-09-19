<?php
require_once __DIR__ . '/db.php';

$action = $_GET['action'] ?? '';
$db = getDB();

if ($action === 'list') {
    $projectId = $_GET['project_id'] ?? '';
    $toUser = $_GET['to'] ?? ''; // 'admin' or user ID

    if (!$projectId) jsonResponse(['notifications' => []]);

    if ($toUser) {
        $stmt = $db->prepare("SELECT id, project_id as projectId, to_user as `to`, message, time 
                              FROM notifications 
                              WHERE project_id = ? AND (to_user = ? OR to_user = 'all') 
                              ORDER BY time DESC LIMIT 50");
        $stmt->execute([$projectId, $toUser]);
    } else {
        $stmt = $db->prepare("SELECT id, project_id as projectId, to_user as `to`, message, time 
                              FROM notifications 
                              WHERE project_id = ? 
                              ORDER BY time DESC LIMIT 50");
        $stmt->execute([$projectId]);
    }

    jsonResponse(['notifications' => $stmt->fetchAll()]);
}

if ($action === 'create') {
    $data = getBody();
    $id = (string)time() . substr(md5(uniqid()), 0, 5);
    $projectId = $data['project_id'] ?? '';
    $to = $data['to'] ?? 'admin';
    $message = $data['message'] ?? '';
    $time = time() * 1000;

    if (!$projectId || !$message) jsonResponse(['error' => 'Project ID and message required.'], 400);

    $stmt = $db->prepare("INSERT INTO notifications (id, project_id, to_user, message, time) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$id, $projectId, $to, $message, $time]);

    jsonResponse(['success' => true]);
}

jsonResponse(['error' => 'Invalid action.'], 400);
