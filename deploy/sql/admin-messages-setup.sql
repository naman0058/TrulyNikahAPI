-- Admin notifications table (if missing on production)
CREATE TABLE IF NOT EXISTS `admin_messages` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `sender_id` BIGINT UNSIGNED NULL,
  `receiver_id` BIGINT UNSIGNED NULL,
  `message` TEXT NOT NULL,
  `read_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `admin_messages_receiver_id_index` (`receiver_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
