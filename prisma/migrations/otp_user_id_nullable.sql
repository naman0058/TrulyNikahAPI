-- Run once on shared MySQL if otps.user_id is NOT NULL (mobile auth for new users)
-- mysql -u ... -p database_name < prisma/migrations/otp_user_id_nullable.sql

ALTER TABLE `otps` MODIFY `user_id` BIGINT UNSIGNED NULL;
