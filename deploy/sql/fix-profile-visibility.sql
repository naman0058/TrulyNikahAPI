-- Fix invalid empty profile_visibility values (causes Prisma/dashboard errors)
UPDATE `users`
SET `profile_visibility` = 'everyone'
WHERE `profile_visibility` IS NULL OR `profile_visibility` = '';
