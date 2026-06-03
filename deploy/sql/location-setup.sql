-- TrulyNikah — location tables + India states (direct DB update, no artisan)
-- Run against your production MySQL database (phpMyAdmin / mysql CLI).
-- Safe to re-run: uses IF NOT EXISTS and skips states if India already has rows.

-- ---------------------------------------------------------------------------
-- 1) Tables (same as Laravel migrations)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `countries` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `states` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `country_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `states_country_id_foreign` (`country_id`),
  CONSTRAINT `states_country_id_foreign` FOREIGN KEY (`country_id`) REFERENCES `countries` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cities` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `state_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `cities_state_id_foreign` (`state_id`),
  CONSTRAINT `cities_state_id_foreign` FOREIGN KEY (`state_id`) REFERENCES `states` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 2) Ensure India exists (StateSeeder assumes country_id = 76 in Laravel only
--    if countries were seeded in default order; we resolve by name instead)
-- ---------------------------------------------------------------------------
INSERT INTO `countries` (`name`, `created_at`, `updated_at`)
SELECT 'India', NOW(), NOW()
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `countries` WHERE `name` = 'India' LIMIT 1);

-- ---------------------------------------------------------------------------
-- 3) India states (from database/seeders/StateSeeder.php) — only if none yet
-- ---------------------------------------------------------------------------
INSERT INTO `states` (`country_id`, `name`, `created_at`, `updated_at`)
SELECT c.id, s.name, NOW(), NOW()
FROM `countries` c
CROSS JOIN (
  SELECT 'Andhra Pradesh' AS name UNION ALL
  SELECT 'Arunachal Pradesh' UNION ALL
  SELECT 'Assam' UNION ALL
  SELECT 'Bihar' UNION ALL
  SELECT 'Chhattisgarh' UNION ALL
  SELECT 'Goa' UNION ALL
  SELECT 'Gujarat' UNION ALL
  SELECT 'Haryana' UNION ALL
  SELECT 'Himachal Pradesh' UNION ALL
  SELECT 'Jharkhand' UNION ALL
  SELECT 'Karnataka' UNION ALL
  SELECT 'Kerala' UNION ALL
  SELECT 'Madhya Pradesh' UNION ALL
  SELECT 'Maharashtra' UNION ALL
  SELECT 'Manipur' UNION ALL
  SELECT 'Meghalaya' UNION ALL
  SELECT 'Mizoram' UNION ALL
  SELECT 'Nagaland' UNION ALL
  SELECT 'Odisha' UNION ALL
  SELECT 'Punjab' UNION ALL
  SELECT 'Rajasthan' UNION ALL
  SELECT 'Sikkim' UNION ALL
  SELECT 'Tamil Nadu' UNION ALL
  SELECT 'Telangana' UNION ALL
  SELECT 'Tripura' UNION ALL
  SELECT 'Uttar Pradesh' UNION ALL
  SELECT 'Uttarakhand' UNION ALL
  SELECT 'West Bengal'
) s
WHERE c.name = 'India'
  AND NOT EXISTS (
    SELECT 1 FROM `states` st WHERE st.country_id = c.id LIMIT 1
  );

-- ---------------------------------------------------------------------------
-- Verify (run manually after import)
-- ---------------------------------------------------------------------------
-- SELECT id, name FROM countries WHERE name = 'India';
-- SELECT COUNT(*) AS state_count FROM states WHERE country_id = (SELECT id FROM countries WHERE name = 'India' LIMIT 1);
-- Use that country id in the app: GET /api/v1/state/{country_id}
