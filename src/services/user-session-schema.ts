import prisma from '../lib/prisma';

let ensured = false;

/** Adds users.api_token_version when missing (shared Laravel DB). */
export async function ensureUserSessionSchema(): Promise<void> {
  if (ensured) return;
  try {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE `users` ADD COLUMN `api_token_version` INT UNSIGNED NOT NULL DEFAULT 0'
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/Duplicate column/i.test(msg)) throw e;
  }
  ensured = true;
}
