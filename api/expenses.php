<?php
require_once __DIR__ . '/db.php';

$action = $_GET['action'] ?? '';
$db = getDB();

// ── GET: List market expenses for a project (optionally filter by date/month)
if ($action === 'list') {
    $pid = $_GET['project_id'] ?? '';
    $date = $_GET['date'] ?? '';
    $month = $_GET['month'] ?? ''; // YYYY-MM
    if (!$pid) jsonResponse(['error' => 'project_id required'], 400);

    $sql = "SELECT me.id, me.project_id as projectId, me.user_id as userId, me.date,
                   me.item, me.amount, me.category, me.note, me.created_at,
                   u.name as userName
            FROM market_expenses me
            LEFT JOIN users u ON me.user_id = u.id
            WHERE me.project_id = ?";
    $params = [$pid];

    if ($date) { $sql .= " AND me.date = ?"; $params[] = $date; }
    if ($month) { $sql .= " AND DATE_FORMAT(me.date,'%Y-%m') = ?"; $params[] = $month; }

    $sql .= " ORDER BY me.date DESC, me.created_at DESC";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) $r['amount'] = floatval($r['amount']);
    jsonResponse(['expenses' => $rows]);
}

// ── POST: Add a new market expense entry
if ($action === 'add') {
    $data = getBody();
    $pid    = $data['project_id'] ?? '';
    $uid    = $data['user_id'] ?? '';
    $date   = $data['date'] ?? date('Y-m-d');
    $item   = trim($data['item'] ?? '');
    $amount = floatval($data['amount'] ?? 0);
    $cat    = $data['category'] ?? 'bazaar';
    $note   = $data['note'] ?? '';

    if (!$pid || !$uid || !$item || $amount <= 0) {
        jsonResponse(['error' => 'project_id, user_id, item and amount are required'], 400);
    }

    $id = 'exp_' . uniqid();
    $stmt = $db->prepare("INSERT INTO market_expenses (id, project_id, user_id, date, item, amount, category, note)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$id, $pid, $uid, $date, $item, $amount, $cat, $note]);

    jsonResponse([
        'success' => true,
        'expense' => ['id' => $id, 'projectId' => $pid, 'userId' => $uid,
                      'date' => $date, 'item' => $item, 'amount' => $amount,
                      'category' => $cat, 'note' => $note]
    ], 201);
}

// ── POST: Update/Edit an existing market expense entry
if ($action === 'update' || $action === 'edit') {
    $data = getBody();
    $id     = $data['id'] ?? '';
    $pid    = $data['project_id'] ?? '';
    $date   = $data['date'] ?? '';
    $item   = trim($data['item'] ?? '');
    $amount = floatval($data['amount'] ?? 0);
    $cat    = $data['category'] ?? 'bazaar';
    $note   = $data['note'] ?? '';

    if (!$id || !$pid || !$item || $amount <= 0 || !$date) {
        jsonResponse(['error' => 'id, project_id, date, item and amount are required'], 400);
    }

    $stmt = $db->prepare("UPDATE market_expenses
                          SET date = ?, item = ?, amount = ?, category = ?, note = ?
                          WHERE id = ? AND project_id = ?");
    $stmt->execute([$date, $item, $amount, $cat, $note, $id, $pid]);

    jsonResponse(['success' => true, 'message' => 'Expense updated successfully']);
}

// ── DELETE: Remove an expense entry
if ($action === 'delete') {
    $data = getBody();
    $id  = $data['id'] ?? '';
    $pid = $data['project_id'] ?? '';
    if (!$id || !$pid) jsonResponse(['error' => 'id and project_id required'], 400);

    $db->prepare("DELETE FROM market_expenses WHERE id = ? AND project_id = ?")->execute([$id, $pid]);
    jsonResponse(['success' => true]);
}

// ── GET: Monthly summary (total per category per day)
if ($action === 'monthly_summary') {
    $pid   = $_GET['project_id'] ?? '';
    $month = $_GET['month'] ?? date('Y-m'); // YYYY-MM
    if (!$pid) jsonResponse(['error' => 'project_id required'], 400);

    $stmt = $db->prepare("SELECT date, SUM(amount) as total_amount, category
                           FROM market_expenses
                           WHERE project_id = ? AND DATE_FORMAT(date,'%Y-%m') = ?
                           GROUP BY date, category
                           ORDER BY date ASC");
    $stmt->execute([$pid, $month]);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) $r['total_amount'] = floatval($r['total_amount']);
    jsonResponse(['summary' => $rows]);
}

jsonResponse(['error' => 'Invalid action.'], 400);
