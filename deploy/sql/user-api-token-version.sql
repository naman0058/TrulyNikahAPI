-- Mobile session: bump api_token_version on logout to invalidate saved JWTs.
-- Run once on production MySQL. Ignore "Duplicate column" if already applied.

ALTER TABLE `users` ADD COLUMN `api_token_version` INT UNSIGNED NOT NULL DEFAULT 0;
