import jwt from 'jsonwebtoken';
import config from '../config';

export type TokenPayload = {
  sub: string;
  type: 'user' | 'admin';
  email: string;
};

export function signUserToken(userId: bigint, email: string): string {
  const payload: TokenPayload = {
    sub: userId.toString(),
    type: 'user',
    email,
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

export function verifyAdminToken(token: string): TokenPayload {
  const payload = jwt.verify(token, config.jwt.adminSecret) as TokenPayload;
  if (payload.type !== 'admin') throw new Error('Invalid token type');
  return payload;
}
