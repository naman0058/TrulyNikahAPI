import { NextFunction, Request, Response } from 'express';
import { ValidationChain } from 'express-validator';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { verifyUserToken } from '../lib/jwt';
import prisma from '../lib/prisma';
import { sendError } from '../utils/response';
import { AppError, ErrorCode } from '../utils/errors';
import { formatValidationErrors, ValidateOptions } from '../utils/validation';
import { User } from '@prisma/client';

export type AuthRequest = Request & { user?: User; userId?: bigint };

export const validate = (validations: ValidationChain[], options?: ValidateOptions) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    await Promise.all(validations.map((v) => v.run(req)));

    const formatted = formatValidationErrors(req, options);
    if (formatted) {
      const errorCount = Object.values(formatted).reduce((sum, arr) => sum + arr.length, 0);
      return sendError(res, 'Validation failed', 422, {
        code: ErrorCode.VALIDATION_ERROR,
        errors: formatted,
        meta: { errorCount, fields: Object.keys(formatted) },
      });
    }
    next();
  };
};

/** Shorthand: validate rules + reject unknown body keys */
export function validateBody(allowedBody: string[], validations: ValidationChain[]) {
  return validate(validations, { allowedBody });
}

/** Shorthand: validate rules + reject unknown query keys */
export function validateQuery(allowedQuery: string[], validations: ValidationChain[]) {
  return validate(validations, { allowedQuery });
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return sendError(res, 'Authentication required', 401, { code: ErrorCode.AUTH_REQUIRED });
    }
    const token = header.slice(7);
    const payload = verifyUserToken(token);
    const user = await prisma.user.findUnique({ where: { id: BigInt(payload.sub) } });
    if (!user) {
      return sendError(res, 'User not found', 401, { code: ErrorCode.AUTH_INVALID });
    }
    req.user = user;
    req.userId = user.id;
    next();
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      return sendError(res, 'Token expired', 401, { code: ErrorCode.AUTH_EXPIRED });
    }
    if (err instanceof JsonWebTokenError) {
      return sendError(res, 'Invalid token', 401, { code: ErrorCode.AUTH_INVALID });
    }
    next(err);
  }
}

export function requirePhoneVerified(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!req.user?.phone_verified) {
    return next(
      AppError.forbidden('Phone number not verified. Please complete OTP verification.', ErrorCode.PHONE_NOT_VERIFIED)
    );
  }
  next();
}

export function requireProfileComplete(req: AuthRequest, _res: Response, next: NextFunction) {
  const u = req.user;
  if (
    !u?.height ||
    !u.country ||
    !u.marital_status ||
    !u.mother_tounge ||
    !u.sect ||
    !u.cast ||
    !u.employed_in ||
    !u.occupation
  ) {
    return next(AppError.forbidden('Please complete your profile before accessing this feature.', ErrorCode.PROFILE_INCOMPLETE));
  }
  next();
}

export function requireNotBlocked(req: AuthRequest, _res: Response, next: NextFunction) {
  if (req.user?.status === 'block' || req.user?.status === 'deleted') {
    return next(AppError.forbidden('Your account is blocked or deleted', ErrorCode.ACCOUNT_BLOCKED));
  }
  next();
}

export const fullUserGuard = [authenticate, requirePhoneVerified, requireProfileComplete, requireNotBlocked];

export function asyncHandler(
  fn: (req: AuthRequest, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/** Wrap multer middleware and forward errors to global handler */
export function wrapUpload(middleware: RequestHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    middleware(req, res, (err?: unknown) => {
      if (err) return next(err);
      next();
    });
  };
}

type RequestHandler = (req: Request, res: Response, next: NextFunction) => void;
