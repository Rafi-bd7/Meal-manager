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

    $sql = "SELECT me.id, me.project_id as projectId, me.user_id as userId,
                   COALESCE(NULLIF(me.shopper_name, ''), NULLIF(me.buyer_name, ''), u.name, 'সদস্য') as userName,
                   COALESCE(NULLIF(me.shopper_name, ''), NULLIF(me.buyer_name, ''), u.name, 'সদস্য') as shopperName,
                   me.shopper_name as customShopper,
                   me.created_by as createdBy,
                   me.date, me.item, me.amount, me.category, me.note,
                   me.created_at, me.updated_at,
                   me.updated_by as updatedBy,
                   u.name as uName,
                   u2.name as updatedByName,
                   u3.name as createdByName
            FROM market_expenses me
            LEFT JOIN users u ON me.user_id = u.id
            LEFT JOIN users u2 ON me.updated_by = u2.id
            LEFT JOIN users u3 ON me.created_by = u3.id
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
    $shopperName = trim($data['shopper_name'] ?? ($data['buyer_name'] ?? ''));
    $createdBy = $data['created_by'] ?? $uid;
    $date   = $data['date'] ?? date('Y-m-d');
    $item   = trim($data['item'] ?? '');
    $amount = floatval($data['amount'] ?? 0);
    $cat    = $data['category'] ?? 'bazaar';
    $note   = $data['note'] ?? '';

    if (!$pid || !$uid || !$item || $amount <= 0) {
        jsonResponse(['error' => 'project_id, user_id, item and amount are required'], 400);
    }

    $id = 'exp_' . uniqid();
    $stmt = $db->prepare("INSERT INTO market_expenses (id, project_id, user_id, shopper_name, buyer_name, created_by, date, item, amount, category, note)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$id, $pid, $uid, $shopperName, $shopperName, $createdBy, $date, $item, $amount, $cat, $note]);

    // Dispatch a project notification so everyone's device is alerted
    $uName = '';
    try {
        $uStmt = $db->prepare("SELECT name FROM users WHERE id = ?");
        $uStmt->execute([$uid]);
        $uRow = $uStmt->fetch();
        $uName = $uRow['name'] ?? '';
        $shopperDisplay = $shopperName ?: ($uName ?: 'মেম্বার');
        
        $notifId = (string)time() . substr(md5(uniqid()), 0, 5);
        $notifMsg = "🛒 {$shopperDisplay} {$item} ({$amount}৳) বাজার খরচ যোগ করেছেন।";
        $notifTime = time() * 1000;
        $db->prepare("INSERT INTO notifications (id, project_id, to_user, message, time) VALUES (?, ?, 'all', ?, ?)")
           ->execute([$notifId, $pid, $notifMsg, $notifTime]);
    } catch (Exception $e) {}

    jsonResponse([
        'success' => true,
        'expense' => ['id' => $id, 'projectId' => $pid, 'userId' => $uid,
                      'userName' => $shopperName ?: ($uName ?: 'সদস্য'),
                      'shopperName' => $shopperName ?: ($uName ?: 'সদস্য'),
                      'createdBy' => $createdBy,
                      'date' => $date, 'item' => $item, 'amount' => $amount,
                      'category' => $cat, 'note' => $note]
    ], 201);
}

// ── POST: Update/Edit an existing market expense entry
if ($action === 'update' || $action === 'edit') {
    $data = getBody();
    $id        = $data['id'] ?? '';
    $pid       = $data['project_id'] ?? '';
    $uid       = $data['user_id'] ?? '';
    $shopperName = isset($data['shopper_name']) ? trim($data['shopper_name']) : (isset($data['buyer_name']) ? trim($data['buyer_name']) : null);
    $updatedBy = $data['updated_by'] ?? ($data['user_id'] ?? null);
    $date      = $data['date'] ?? '';
    $item      = trim($data['item'] ?? '');
    $amount    = floatval($data['amount'] ?? 0);
    $cat       = $data['category'] ?? 'bazaar';
    $note      = $data['note'] ?? '';

    if (!$id || !$item || $amount <= 0 || !$date) {
        jsonResponse(['error' => 'id, date, item and amount are required'], 400);
    }

    if ($uid) {
        $sql = "UPDATE market_expenses
                SET date = ?, item = ?, amount = ?, category = ?, note = ?, user_id = ?, shopper_name = ?, buyer_name = ?, updated_by = ?, updated_at = NOW()
                WHERE id = ?" . ($pid ? " AND project_id = ?" : "");
        $params = [$date, $item, $amount, $cat, $note, $uid, $shopperName, $shopperName, $updatedBy, $id];
        if ($pid) $params[] = $pid;
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
    } else {
        $sql = "UPDATE market_expenses
                SET date = ?, item = ?, amount = ?, category = ?, note = ?, updated_by = ?, updated_at = NOW()
                WHERE id = ?" . ($pid ? " AND project_id = ?" : "");
        $params = [$date, $item, $amount, $cat, $note, $updatedBy, $id];
        if ($pid) $params[] = $pid;
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
    }

    jsonResponse(['success' => true, 'message' => 'Expense updated successfully']);
}

// ── DELETE: Remove an expense entry
if ($action === 'delete') {
    $data = getBody();
    $id  = $data['id'] ?? '';
    $pid = $data['project_id'] ?? '';
    if (!$id) jsonResponse(['error' => 'id required'], 400);

    if ($pid) {
        $db->prepare("DELETE FROM market_expenses WHERE id = ? AND project_id = ?")->execute([$id, $pid]);
    } else {
        $db->prepare("DELETE FROM market_expenses WHERE id = ?")->execute([$id]);
    }
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
