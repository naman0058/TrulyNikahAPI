import { NextFunction, Request, Response } from 'express';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { verifyAdminToken } from '../lib/jwt';
import prisma from '../lib/prisma';
import { AppError, ErrorCode } from '../utils/errors';
import { Admin } from '@prisma/client';

export type AdminRequest = Request & { admin?: Admin; adminId?: bigint };

export async function authenticateAdmin(req: AdminRequest, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return next(AppError.unauthorized('Admin authentication required', ErrorCode.AUTH_REQUIRED));
    }
    const token = header.slice(7);
    const payload = verifyAdminToken(token);
    const admin = await prisma.admin.findUnique({ where: { id: BigInt(payload.sub) } });
    if (!admin) return next(AppError.unauthorized('Admin not found', ErrorCode.AUTH_INVALID));
    req.admin = admin;
    req.adminId = admin.id;
    next();
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      return next(AppError.unauthorized('Admin token expired', ErrorCode.AUTH_EXPIRED));
    }
    if (err instanceof JsonWebTokenError) {
      return next(AppError.unauthorized('Invalid admin token', ErrorCode.AUTH_INVALID));
    }
    next(err);
  }
}

export function adminAsyncHandler(
  fn: (req: AdminRequest, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: AdminRequest, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
