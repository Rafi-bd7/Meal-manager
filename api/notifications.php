<?php
require_once __DIR__ . '/db.php';

$data = getBody();
$action = $_GET['action'] ?? ($data['action'] ?? '');
$db = getDB();

if ($action === 'list') {
    $projectId = $_GET['project_id'] ?? ($data['project_id'] ?? ($data['projectId'] ?? ''));
    $toUser = $_GET['to'] ?? ($data['to'] ?? ($data['to_user'] ?? '')); // 'admin' or user ID

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

if ($action === 'create' || $action === 'send') {
    $id = (string)time() . substr(md5(uniqid()), 0, 5);
    $projectId = $data['project_id'] ?? ($data['projectId'] ?? ($_GET['project_id'] ?? ''));
    $to = $data['to'] ?? ($data['to_user'] ?? 'all');
    $message = $data['message'] ?? '';
    $time = time() * 1000;

    if (!$projectId || !$message) jsonResponse(['error' => 'Project ID and message required.'], 400);

    $stmt = $db->prepare("INSERT INTO notifications (id, project_id, to_user, message, time) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$id, $projectId, $to, $message, $time]);

    jsonResponse(['success' => true, 'id' => $id]);
}

if ($action === 'delete') {
    $id = $data['id'] ?? ($_GET['id'] ?? '');
    if (!$id) jsonResponse(['error' => 'Notification ID required.'], 400);

    $stmt = $db->prepare("DELETE FROM notifications WHERE id = ?");
    $stmt->execute([$id]);

    jsonResponse(['success' => true, 'message' => 'Notification deleted.']);
}

if ($action === 'delete_all' || $action === 'clear_all') {
    $projectId = $data['project_id'] ?? ($data['projectId'] ?? ($_GET['project_id'] ?? ''));
    $userId = $data['user_id'] ?? ($data['userId'] ?? ($_GET['user_id'] ?? ''));

    if (!$projectId) jsonResponse(['error' => 'Project ID required.'], 400);

    if ($userId) {
        $stmt = $db->prepare("DELETE FROM notifications WHERE project_id = ? AND (to_user = ? OR to_user = 'all')");
        $stmt->execute([$projectId, $userId]);
    } else {
        $stmt = $db->prepare("DELETE FROM notifications WHERE project_id = ?");
        $stmt->execute([$projectId]);
    }

    jsonResponse(['success' => true, 'message' => 'All notifications deleted.', 'deleted' => $stmt->rowCount()]);
}

jsonResponse(['error' => 'Invalid action.'], 400);

