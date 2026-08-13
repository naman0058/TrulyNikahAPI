import jwt from 'jsonwebtoken';
import config from '../config';

export type TokenPayload = {
  sub: string;
  type: 'user' | 'admin';
  email: string;
  /** Bumped on password change / forced logout — must match users.api_token_version */
  tv?: number;
  exp?: number;
  iat?: number;
};

/** Coalesce missing/null DB or JWT token version to 0 (legacy tokens). */
export function normalizeTokenVersion(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return parseInt(value.trim(), 10);
  }
  return 0;
}

export function tokenVersionFromPayload(payload: TokenPayload): number {
  return normalizeTokenVersion(payload.tv);
}

export function userTokenVersion(user: { api_token_version?: number | null }): number {
  return normalizeTokenVersion(user.api_token_version);
}

export function tokenVersionsMatch(
  payload: TokenPayload,
  user: { api_token_version?: number | null }
): boolean {
  return tokenVersionFromPayload(payload) === userTokenVersion(user);
}

export function signUserToken(userId: bigint, email: string, tokenVersion = 0): string {
  const payload: TokenPayload = {
    sub: userId.toString(),
    type: 'user',
    email,
    tv: normalizeTokenVersion(tokenVersion),
  };
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresInSeconds,
  });
}

export function signAdminToken(adminId: bigint, email: string): string {
  const payload: TokenPayload = {
    sub: adminId.toString(),
    type: 'admin',
    email,
  };
  return jwt.sign(payload, config.jwt.adminSecret, {
    expiresIn: config.jwt.adminExpiresIn,
  } as jwt.SignOptions);
}

export function verifyUserToken(token: string): TokenPayload {
  const payload = jwt.verify(token, config.jwt.secret) as TokenPayload;
  if (payload.type !== 'user') throw new Error('Invalid token type');
  return payload;
}

/** For POST /auth/refresh — signature valid even if exp passed */
export function verifyUserTokenAllowExpired(token: string): TokenPayload {
  const payload = jwt.verify(token, config.jwt.secret, { ignoreExpiration: true }) as TokenPayload;
  if (payload.type !== 'user') throw new Error('Invalid token type');
  return payload;
}

export function verifyAdminToken(token: string): TokenPayload {
  const payload = jwt.verify(token, config.jwt.adminSecret) as TokenPayload;
  if (payload.type !== 'admin') throw new Error('Invalid token type');
  return payload;
}
