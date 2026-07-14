-- Message chat requests between users (Node API)
-- Safe to run multiple times on production (phpMyAdmin / mysql CLI).

CREATE TABLE IF NOT EXISTS `message_requests` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `from_user_id` BIGINT UNSIGNED NOT NULL,
  `to_user_id` BIGINT UNSIGNED NOT NULL,
  `message` TEXT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `message_requests_from_user_id_to_user_id_unique` (`from_user_id`, `to_user_id`),
  KEY `message_requests_to_user_id_foreign` (`to_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- If table already existed without these columns, add them (ignore "Duplicate column" errors in phpMyAdmin):
-- ALTER TABLE `message_requests` ADD COLUMN `message` TEXT NULL;
-- ALTER TABLE `message_requests` ADD COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'pending';
-- ALTER TABLE `message_requests` ADD COLUMN `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP;
-- ALTER TABLE `message_requests` ADD COLUMN `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP;

-- Presence: last time user was online (Socket.io)
-- ALTER TABLE `users` ADD COLUMN `last_seen_at` TIMESTAMP NULL DEFAULT NULL;
