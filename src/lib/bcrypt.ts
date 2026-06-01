import bcrypt from 'bcrypt';
import config from '../config';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, config.bcryptRounds);
}

/** Verify password against Laravel bcrypt hash ($2y$ / $2a$ / $2b$). */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const normalized = hash.startsWith('$2y$') ? hash.replace('$2y$', '$2a$') : hash;
  return bcrypt.compare(password, normalized);
}
