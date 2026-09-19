<?php
require_once __DIR__ . '/db.php';

$action = $_GET['action'] ?? '';
$db = getDB();

// ── GET: Get monthly bills for a project + month
if ($action === 'get') {
    $pid   = $_GET['project_id'] ?? '';
    $month = $_GET['month'] ?? date('Y-m');
    if (!$pid) jsonResponse(['error' => 'project_id required'], 400);

    $stmt = $db->prepare("SELECT * FROM monthly_bills WHERE project_id = ? AND month_year = ?");
    $stmt->execute([$pid, $month]);
    $row = $stmt->fetch();

    if (!$row) {
        // Return zeros
        jsonResponse(['bills' => [
            'project_id' => $pid, 'month_year' => $month,
            'house_rent' => 0, 'cook_salary' => 0, 'wifi_bill' => 0,
            'gas_bill' => 0, 'electricity_bill' => 0, 'garbage_bill' => 0,
            'other_bills' => 0, 'other_bills_note' => ''
        ]]);
    }

    // Cast to float
    foreach (['house_rent','cook_salary','wifi_bill','gas_bill','electricity_bill','garbage_bill','other_bills'] as $f) {
        $row[$f] = floatval($row[$f]);
    }
    jsonResponse(['bills' => $row]);
}

// ── POST: Save/Update monthly bills (upsert)
if ($action === 'save') {
    $data  = getBody();
    $pid   = $data['project_id'] ?? '';
    $month = $data['month_year'] ?? date('Y-m');

    if (!$pid) jsonResponse(['error' => 'project_id required'], 400);

    $rent  = floatval($data['house_rent'] ?? 0);
    $cook  = floatval($data['cook_salary'] ?? 0);
    $wifi  = floatval($data['wifi_bill'] ?? 0);
    $gas   = floatval($data['gas_bill'] ?? 0);
    $elec  = floatval($data['electricity_bill'] ?? 0);
    $garb  = floatval($data['garbage_bill'] ?? 0);
    $other = floatval($data['other_bills'] ?? 0);
    $note  = $data['other_bills_note'] ?? '';
    $id    = 'bill_' . md5($pid . $month);

    $stmt = $db->prepare("INSERT INTO monthly_bills
        (id, project_id, month_year, house_rent, cook_salary, wifi_bill, gas_bill, electricity_bill, garbage_bill, other_bills, other_bills_note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            house_rent=VALUES(house_rent), cook_salary=VALUES(cook_salary),
            wifi_bill=VALUES(wifi_bill), gas_bill=VALUES(gas_bill),
            electricity_bill=VALUES(electricity_bill), garbage_bill=VALUES(garbage_bill),
            other_bills=VALUES(other_bills), other_bills_note=VALUES(other_bills_note)");

    $stmt->execute([$id, $pid, $month, $rent, $cook, $wifi, $gas, $elec, $garb, $other, $note]);

    jsonResponse(['success' => true, 'bills' => [
        'project_id' => $pid, 'month_year' => $month,
        'house_rent' => $rent, 'cook_salary' => $cook,
        'wifi_bill' => $wifi, 'gas_bill' => $gas,
        'electricity_bill' => $elec, 'garbage_bill' => $garb,
        'other_bills' => $other, 'other_bills_note' => $note
    ]]);
}

// ── GET: All bills for a project (all months)
if ($action === 'list_all') {
    $pid = $_GET['project_id'] ?? '';
    if (!$pid) jsonResponse(['error' => 'project_id required'], 400);

    $stmt = $db->prepare("SELECT * FROM monthly_bills WHERE project_id = ? ORDER BY month_year DESC");
    $stmt->execute([$pid]);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$row) {
        foreach (['house_rent','cook_salary','wifi_bill','gas_bill','electricity_bill','garbage_bill','other_bills'] as $f) {
            $row[$f] = floatval($row[$f]);
        }
    }
    jsonResponse(['bills' => $rows]);
}

jsonResponse(['error' => 'Invalid action.'], 400);
