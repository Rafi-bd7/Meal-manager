<?php
require_once __DIR__ . '/db.php';

$action = $_GET['action'] ?? '';
$db = getDB();

if ($action === 'register') {
    $data = getBody();
    $name = trim($data['name'] ?? '');
    $email = trim(strtolower($data['email'] ?? ''));
    $password = $data['password'] ?? '';
    $role = ($data['role'] ?? 'user') === 'admin' ? 'admin' : 'user';

    if (!$name || !$email || !$password) {
        jsonResponse(['error' => 'All fields (name, email, password) are required.'], 400);
    }

    // Check email uniqueness
    $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        jsonResponse(['error' => 'Email already registered!'], 409);
    }

    $id = (string)time() . substr(md5(uniqid()), 0, 5);
    $stmt = $db->prepare("INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$id, $name, $email, $password, $role]);

    jsonResponse([
        'success' => true,
        'message' => 'Registration successful! Please sign in.',
        'user' => ['id' => $id, 'name' => $name, 'email' => $email, 'role' => $role]
    ], 201);
}

if ($action === 'login') {
    $data = getBody();
    $email = trim(strtolower($data['email'] ?? ''));
    $password = $data['password'] ?? '';

    if (!$email || !$password) {
        jsonResponse(['error' => 'Email and password are required.'], 400);
    }

    $stmt = $db->prepare("SELECT id, name, email, password, role, photo FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || $user['password'] !== $password) {
        jsonResponse(['error' => 'Invalid email or password.'], 401);
    }

    // Don't send password in response
    unset($user['password']);

    jsonResponse([
        'success' => true,
        'message' => 'Login successful!',
        'user' => $user
    ]);
}

if ($action === 'users') {
    $stmt = $db->query("SELECT id, name, email, role, photo, created_at FROM users ORDER BY name ASC");
    $users = $stmt->fetchAll();
    jsonResponse(['users' => $users]);
}

if ($action === 'update_photo') {
    $data = getBody();
    $userId = $data['user_id'] ?? '';
    $photo = $data['photo'] ?? '';

    if (!$userId || !$photo) {
        jsonResponse(['error' => 'User ID and photo data required.'], 400);
    }

    $stmt = $db->prepare("UPDATE users SET photo = ? WHERE id = ?");
    $stmt->execute([$photo, $userId]);

    jsonResponse(['success' => true, 'message' => 'Profile photo updated!']);
}

if ($action === 'delete_user') {
    $data = getBody();
    $userId = $data['user_id'] ?? '';
    if (!$userId) jsonResponse(['error' => 'User ID required.'], 400);

    $db->prepare("DELETE FROM users WHERE id = ?")->execute([$userId]);
    $db->prepare("DELETE FROM enrollments WHERE user_id = ?")->execute([$userId]);
    $db->prepare("DELETE FROM meal_records WHERE user_id = ?")->execute([$userId]);
    $db->prepare("DELETE FROM comments WHERE user_id = ?")->execute([$userId]);

    jsonResponse(['success' => true, 'message' => 'User removed from database.']);
}

jsonResponse(['error' => 'Invalid action.'], 400);
