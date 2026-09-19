-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: meal_manager_db
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `meal_manager_db`
--

-- CREATE DATABASE /*!32312 IF NOT EXISTS*/ `meal_manager_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */;

-- USE `meal_manager_db`;

--
-- Table structure for table `chats`
--

DROP TABLE IF EXISTS `chats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `chats` (
  `id` varchar(64) NOT NULL,
  `project_id` varchar(64) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `user_name` varchar(100) NOT NULL,
  `text` text NOT NULL,
  `time` bigint(20) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `time` (`time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chats`
--

LOCK TABLES `chats` WRITE;
/*!40000 ALTER TABLE `chats` DISABLE KEYS */;
INSERT INTO `chats` VALUES ('1789813368e9ff7','1789812150dc0b5','17898132533b7cb','Mehedi Hasan','Fuck you',1789813368746,'2026-09-19 10:22:48'),('178981439353029','1789812150dc0b5','1789814329c6309','Rrafi','Hiii',1789814393981,'2026-09-19 10:39:53');
/*!40000 ALTER TABLE `chats` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `comments`
--

DROP TABLE IF EXISTS `comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `comments` (
  `id` varchar(64) NOT NULL,
  `project_id` varchar(64) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `text` text NOT NULL,
  `time` bigint(20) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `comments`
--

LOCK TABLES `comments` WRITE;
/*!40000 ALTER TABLE `comments` DISABLE KEYS */;
/*!40000 ALTER TABLE `comments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `enrollments`
--

DROP TABLE IF EXISTS `enrollments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `enrollments` (
  `id` varchar(128) NOT NULL,
  `project_id` varchar(64) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `money_given` decimal(10,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `enrollments`
--

LOCK TABLES `enrollments` WRITE;
/*!40000 ALTER TABLE `enrollments` DISABLE KEYS */;
INSERT INTO `enrollments` VALUES ('178980539042879_1789805588fb65c','178980539042879','1789805588fb65c','approved',0.00,'2026-09-19 08:13:08'),('1789812150dc0b5_17898132533b7cb','1789812150dc0b5','17898132533b7cb','approved',1100.00,'2026-09-19 10:21:10'),('1789812150dc0b5_1789814329c6309','1789812150dc0b5','1789814329c6309','approved',1500.00,'2026-09-19 10:39:07');
/*!40000 ALTER TABLE `enrollments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `market_expenses`
--

DROP TABLE IF EXISTS `market_expenses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `market_expenses` (
  `id` varchar(64) NOT NULL,
  `project_id` varchar(64) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `date` date NOT NULL,
  `item` varchar(200) NOT NULL,
  `amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `category` varchar(50) NOT NULL DEFAULT 'bazaar',
  `note` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `market_expenses`
--

LOCK TABLES `market_expenses` WRITE;
/*!40000 ALTER TABLE `market_expenses` DISABLE KEYS */;
/*!40000 ALTER TABLE `market_expenses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `meal_records`
--

DROP TABLE IF EXISTS `meal_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `meal_records` (
  `id` varchar(128) NOT NULL,
  `project_id` varchar(64) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `date` date NOT NULL,
  `breakfast` tinyint(1) NOT NULL DEFAULT 0,
  `lunch` tinyint(1) NOT NULL DEFAULT 0,
  `dinner` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `user_id` (`user_id`),
  KEY `date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `meal_records`
--

LOCK TABLES `meal_records` WRITE;
/*!40000 ALTER TABLE `meal_records` DISABLE KEYS */;
/*!40000 ALTER TABLE `meal_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `monthly_bills`
--

DROP TABLE IF EXISTS `monthly_bills`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `monthly_bills` (
  `id` varchar(64) NOT NULL,
  `project_id` varchar(64) NOT NULL,
  `month_year` varchar(7) NOT NULL,
  `house_rent` decimal(10,2) NOT NULL DEFAULT 0.00,
  `cook_salary` decimal(10,2) NOT NULL DEFAULT 0.00,
  `wifi_bill` decimal(10,2) NOT NULL DEFAULT 0.00,
  `gas_bill` decimal(10,2) NOT NULL DEFAULT 0.00,
  `electricity_bill` decimal(10,2) NOT NULL DEFAULT 0.00,
  `garbage_bill` decimal(10,2) NOT NULL DEFAULT 0.00,
  `other_bills` decimal(10,2) NOT NULL DEFAULT 0.00,
  `other_bills_note` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `project_month` (`project_id`,`month_year`),
  KEY `project_id` (`project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `monthly_bills`
--

LOCK TABLES `monthly_bills` WRITE;
/*!40000 ALTER TABLE `monthly_bills` DISABLE KEYS */;
/*!40000 ALTER TABLE `monthly_bills` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `notifications` (
  `id` varchar(64) NOT NULL,
  `project_id` varchar(64) NOT NULL,
  `to_user` varchar(64) NOT NULL,
  `message` varchar(255) NOT NULL,
  `time` bigint(20) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `to_user` (`to_user`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
INSERT INTO `notifications` VALUES ('17898056880b7c0','178980539042879','1789805588fb65c','Admin updated your meal for 2026-09-19.',1789805688000,'2026-09-19 08:14:48');
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `projects`
--

DROP TABLE IF EXISTS `projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `projects` (
  `id` varchar(64) NOT NULL,
  `name` varchar(100) NOT NULL,
  `admin_id` varchar(64) NOT NULL,
  `menu` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`menu`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `admin_id` (`admin_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects`
--

LOCK TABLES `projects` WRITE;
/*!40000 ALTER TABLE `projects` DISABLE KEYS */;
INSERT INTO `projects` VALUES ('17898053901d467','October 2026 Mess','178980504836440','{\"Saturday\":{\"b\":\"\",\"l\":\"\",\"d\":\"\"},\"Sunday\":{\"b\":\"\",\"l\":\"\",\"d\":\"\"},\"Monday\":{\"b\":\"\",\"l\":\"\",\"d\":\"\"},\"Tuesday\":{\"b\":\"\",\"l\":\"\",\"d\":\"\"},\"Wednesday\":{\"b\":\"\",\"l\":\"\",\"d\":\"\"},\"Thursday\":{\"b\":\"\",\"l\":\"\",\"d\":\"\"},\"Friday\":{\"b\":\"\",\"l\":\"\",\"d\":\"\"}}','2026-09-19 08:09:50'),('178980539042879','October 2026 Mess','178980504836440','{\"Saturday\":{\"b\":\"\",\"l\":\"\",\"d\":\"\"},\"Sunday\":{\"b\":\"\",\"l\":\"\",\"d\":\"\"},\"Monday\":{\"b\":\"\",\"l\":\"\",\"d\":\"\"},\"Tuesday\":{\"b\":\"\",\"l\":\"\",\"d\":\"\"},\"Wednesday\":{\"b\":\"\",\"l\":\"\",\"d\":\"\"},\"Thursday\":{\"b\":\"\",\"l\":\"\",\"d\":\"\"},\"Friday\":{\"b\":\"\",\"l\":\"\",\"d\":\"\"}}','2026-09-19 08:09:50'),('1789812150dc0b5','SEP \' 2026','178981208890d84','{\"Saturday\":{\"b\":\"\",\"l\":\"\",\"d\":\"\"},\"Sunday\":{\"b\":\"\",\"l\":\"\",\"d\":\"\"},\"Monday\":{\"b\":\"\",\"l\":\"\",\"d\":\"\"},\"Tuesday\":{\"b\":\"\",\"l\":\"\",\"d\":\"\"},\"Wednesday\":{\"b\":\"\",\"l\":\"\",\"d\":\"\"},\"Thursday\":{\"b\":\"\",\"l\":\"\",\"d\":\"\"},\"Friday\":{\"b\":\"\",\"l\":\"\",\"d\":\"\"}}','2026-09-19 10:02:30');
/*!40000 ALTER TABLE `projects` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` varchar(64) NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('admin','user') NOT NULL DEFAULT 'user',
  `photo` longtext DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES ('178981208890d84','rafi','redwanrafi8659@gmail.com','123456','admin',NULL,'2026-09-19 10:01:28'),('17898132533b7cb','Mehedi Hasan','mehedihasan2272002@gmail.com','123456','user','data:image/jpeg;base64,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','2026-09-19 10:20:53'),('1789814329c6309','Rafi','rafiami73@gmail.com','1234','user',NULL,'2026-09-19 10:38:49');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-19 16:57:54
