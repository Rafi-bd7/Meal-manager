<?php
// ══════════════════════════════════════════════════════════════════════
// api/db.php — Database Configuration for MealManager
// ══════════════════════════════════════════════════════════════════════
//
// ✅ XAMPP (Local):
//    $host   = '127.0.0.1';
//    $user   = 'root';
//    $pass   = '';
//    $dbname = 'meal_manager_db';
//    $port   = '3306';
//
// ✅ InfinityFree (Free Hosting):
//    $host   = 'sql200.infinityfree.com';  ← আপনার MySQL hostname
//    $user   = 'epiz_xxxxxxx';             ← আপনার DB username
//    $pass   = 'yourpassword';             ← আপনার DB password
//    $dbname = 'epiz_xxxxxxx_meals';       ← আপনার DB name
//    $port   = '3306';
//
// ✅ Hostinger / Other cPanel Hosting:
//    $host   = 'localhost';
//    $user   = 'your_db_user';
//    $pass   = 'your_db_pass';
//    $dbname = 'your_db_name';
//    $port   = '3306';
// ══════════════════════════════════════════════════════════════════════

// ── Database Configuration (Render / Cloud / Localhost / InfinityFree) ──
$envHost = getenv('DB_HOST') ?: ($_ENV['DB_HOST'] ?? null);
$envUser = getenv('DB_USER') ?: ($_ENV['DB_USER'] ?? null);
$envPass = getenv('DB_PASS') ?: ($_ENV['DB_PASS'] ?? '');
$envName = getenv('DB_NAME') ?: ($_ENV['DB_NAME'] ?? null);
$envPort = getenv('DB_PORT') ?: ($_ENV['DB_PORT'] ?? '3306');

$isLocal = in_array($_SERVER['SERVER_NAME'] ?? '', ['localhost', '127.0.0.1']) || 
           in_array($_SERVER['HTTP_HOST'] ?? '', ['localhost', '127.0.0.1']) ||
           (php_sapi_name() === 'cli-server');

$serverHost = $_SERVER['HTTP_HOST'] ?? ($_SERVER['SERVER_NAME'] ?? '');

if ($envHost) {
    // Cloud / Render Environment Variables
    $host   = $envHost;
    $port   = $envPort;
    $user   = $envUser;
    $pass   = $envPass;
    $dbname = $envName;
} elseif (strpos($serverHost, 'alwaysdata.net') !== false || file_exists('/home/mealmanager')) {
    // Alwaysdata Hosting
    $host   = 'mysql-mealmanager.alwaysdata.net';
    $port   = '3306';
    $user   = 'mealmanager';
    $pass   = '@@mealmanager@@';
    $dbname = 'mealmanager_meals';
} elseif ($isLocal) {
    $host   = '127.0.0.1';
    $port   = '3306';
    $user   = 'root';
    $pass   = '';
    $dbname = 'meal_manager_db';
} else {
    // Fallback to Alwaysdata if hosted
    $host   = 'mysql-mealmanager.alwaysdata.net';
    $port   = '3306';
    $user   = 'mealmanager';
    $pass   = '@@mealmanager@@';
    $dbname = 'mealmanager_meals';
}
// ──────────────────────────────────────────────────────────────────────

// Enable CORS (required for cross-device access on LAN and hosting)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(200); exit; }

function getDB() {
    global $host, $port, $user, $pass, $dbname, $isLocal;
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    try {
        // Connect to MySQL server
        $pdo = new PDO("mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4", $user, $pass, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::ATTR_PERSISTENT         => false,
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci, time_zone='+06:00'",
        ]);

        // Check if tables exist, if not create them from schema
        $check = $pdo->query("SHOW TABLES LIKE 'users'")->fetch();
        if (!$check) {
            initTables($pdo);
        }

        return $pdo;
    } catch (PDOException $e) {
        if ($isLocal) {
            try {
                $rootPdo = new PDO("mysql:host=$host;port=$port;charset=utf8mb4", $user, $pass);
                $rootPdo->exec("CREATE DATABASE IF NOT EXISTS `$dbname` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
                $pdo = new PDO("mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4", $user, $pass);
                initTables($pdo);
                return $pdo;
            } catch (Exception $ex) {}
        }
        jsonResponse([
            'error' => 'Database connection failed: ' . $e->getMessage()
        ], 500);
        exit;
    }
}

function initTables($pdo) {
    $sqlFile = __DIR__ . '/../database.sql';
    if (file_exists($sqlFile)) {
        // Split by semicolons and run each statement individually to avoid errors
        $sql = file_get_contents($sqlFile);
        $statements = array_filter(array_map('trim', explode(';', $sql)));
        foreach ($statements as $stmt) {
            if ($stmt) {
                try { $pdo->exec($stmt); } catch (PDOException $e) { /* ignore individual errors */ }
            }
        }
    }
    // Auto-migrate: ensure new tables exist even on older installs
    $pdo->exec("CREATE TABLE IF NOT EXISTS `market_expenses` (
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
    $pdo->exec("CREATE TABLE IF NOT EXISTS `monthly_bills` (
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
}


function jsonResponse($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Expires: 0');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function getBody() {
    $raw = file_get_contents('php://input');
    if (!empty($raw)) {
        $data = json_decode($raw, true);
        if (is_array($data)) return $data;
    }
    return $_POST;
}
