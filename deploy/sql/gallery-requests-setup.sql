-- Gallery access requests between users (Node API)
-- Safe to run multiple times on production.

CREATE TABLE IF NOT EXISTS `gallery_requests` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `from_user_id` BIGINT UNSIGNED NOT NULL,
  `to_user_id` BIGINT UNSIGNED NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `gallery_requests_from_user_id_to_user_id_unique` (`from_user_id`, `to_user_id`),
  KEY `gallery_requests_to_user_id_foreign` (`to_user_id`),
  CONSTRAINT `gallery_requests_from_user_id_foreign` FOREIGN KEY (`from_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `gallery_requests_to_user_id_foreign` FOREIGN KEY (`to_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- If an older table exists without these columns, add them (ignore duplicate-column errors).
ALTER TABLE `gallery_requests` ADD COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'pending';
ALTER TABLE `gallery_requests` ADD COLUMN `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE `gallery_requests` ADD COLUMN `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP;
