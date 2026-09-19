<?php
require_once __DIR__ . '/db.php';

$action = $_GET['action'] ?? '';
$db = getDB();

if ($action === 'state') {
    // ── Ensure new tables exist (auto-migrate) ──────────────────────────
    $db->exec("CREATE TABLE IF NOT EXISTS `market_expenses` (
        `id` VARCHAR(64) PRIMARY KEY,
        `project_id` VARCHAR(64) NOT NULL,
        `user_id` VARCHAR(64) NOT NULL,
        `date` DATE NOT NULL,
        `item` VARCHAR(200) NOT NULL,
        `amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        `category` VARCHAR(50) NOT NULL DEFAULT 'bazaar',
        `note` TEXT NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (`project_id`), INDEX (`date`)
    ) ENGINE=InnoDB");

    $db->exec("CREATE TABLE IF NOT EXISTS `monthly_bills` (
        `id` VARCHAR(64) PRIMARY KEY,
        `project_id` VARCHAR(64) NOT NULL,
        `month_year` VARCHAR(7) NOT NULL,
        `house_rent` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        `cook_salary` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        `wifi_bill` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        `gas_bill` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        `electricity_bill` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        `garbage_bill` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        `other_bills` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        `other_bills_note` TEXT NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY `project_month` (`project_id`, `month_year`),
        INDEX (`project_id`)
    ) ENGINE=InnoDB");

    // Return unified snapshot of all tables
    $users = $db->query("SELECT id, name, email, password, role, photo, created_at FROM users")->fetchAll();
    
    $projects = $db->query("SELECT id, name, admin_id, menu, created_at FROM projects")->fetchAll();
    foreach ($projects as &$p) {
        $p['menu'] = !empty($p['menu']) ? json_decode($p['menu'], true) : [];
    }

    $enrolls = $db->query("SELECT id, project_id as projectId, user_id as userId, status, money_given as moneyGiven FROM enrollments")->fetchAll();
    foreach ($enrolls as &$e) {
        $e['moneyGiven'] = floatval($e['moneyGiven']);
    }

    $records = $db->query("SELECT id, project_id as projectId, user_id as userId, date, breakfast, lunch, dinner FROM meal_records")->fetchAll();
    foreach ($records as &$r) {
        $r['breakfast'] = (bool)$r['breakfast'];
        $r['lunch'] = (bool)$r['lunch'];
        $r['dinner'] = (bool)$r['dinner'];
    }

    // Ensure comments reply columns exist
    try {
        $db->exec("ALTER TABLE `comments` ADD COLUMN IF NOT EXISTS `reply` TEXT NULL");
        $db->exec("ALTER TABLE `comments` ADD COLUMN IF NOT EXISTS `reply_time` BIGINT NULL");
    } catch (Exception $e) {}

    $comments = $db->query("SELECT c.id, c.project_id as projectId, c.user_id as userId,
        u.name as userName, c.text, c.time, c.reply, c.reply_time as replyTime
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
        ORDER BY c.time DESC")->fetchAll();
    $chats = $db->query("SELECT id, project_id as projectId, user_id as userId, user_name as userName, text, time FROM chats ORDER BY time ASC")->fetchAll();
    $notifs = $db->query("SELECT id, project_id as projectId, to_user as `to`, message, time FROM notifications ORDER BY time DESC LIMIT 100")->fetchAll();

    // Market Expenses
    $expenses = $db->query("SELECT me.id, me.project_id as projectId, me.user_id as userId,
        me.updated_by as updatedBy, me.date, me.item, me.amount, me.category, me.note,
        me.created_at as createdAt, me.updated_at as updatedAt,
        u.name as userName, u2.name as updatedByName
        FROM market_expenses me
        LEFT JOIN users u ON me.user_id = u.id
        LEFT JOIN users u2 ON me.updated_by = u2.id
        ORDER BY me.date DESC, me.created_at DESC LIMIT 500")->fetchAll();
    foreach ($expenses as &$ex) {
        $ex['amount'] = floatval($ex['amount']);
    }

    // New: Monthly Bills
    $bills = $db->query("SELECT id, project_id as projectId, month_year as monthYear,
        house_rent as houseRent, cook_salary as cookSalary,
        wifi_bill as wifiBill, gas_bill as gasBill,
        electricity_bill as electricityBill, garbage_bill as garbageBill,
        other_bills as otherBills, other_bills_note as otherBillsNote
        FROM monthly_bills ORDER BY month_year DESC")->fetchAll();
    foreach ($bills as &$b) {
        foreach (['houseRent','cookSalary','wifiBill','gasBill','electricityBill','garbageBill','otherBills'] as $f) {
            $b[$f] = floatval($b[$f]);
        }
    }

    jsonResponse([
        'meal_users'        => $users,
        'meal_projects'     => $projects,
        'meal_enrollments'  => $enrolls,
        'meal_records'      => $records,
        'meal_comments'     => $comments,
        'meal_chats'        => $chats,
        'meal_notifications'=> $notifs,
        'meal_expenses'     => $expenses,
        'meal_bills'        => $bills
    ]);
}

jsonResponse(['error' => 'Invalid action.'], 400);
