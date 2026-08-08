import jwt from 'jsonwebtoken';
import config from '../config';

export type TokenPayload = {
  sub: string;
  type: 'user' | 'admin';
  email: string;
  /** Bumped on logout — must match users.api_token_version */
  tv?: number;
  exp?: number;
  iat?: number;
};

export function tokenVersionFromPayload(payload: TokenPayload): number {
  return payload.tv ?? 0;
}

export function signUserToken(userId: bigint, email: string, tokenVersion = 0): string {
  const payload: TokenPayload = {
    sub: userId.toString(),
    type: 'user',
    email,
    tv: tokenVersion,
  };
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn } as jwt.SignOptions);
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
