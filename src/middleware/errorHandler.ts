import { NextFunction, Request, Response } from 'express';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import config from '../config';
import { AppError, ErrorCode } from '../utils/errors';
import { sendError } from '../utils/response';

export { AppError, ErrorCode } from '../utils/errors';

export function notFoundHandler(req: Request, res: Response) {
  return sendError(res, `Route not found: ${req.method} ${req.originalUrl}`, 404, {
    code: ErrorCode.NOT_FOUND,
  });
}

function handlePrismaError(err: Prisma.PrismaClientKnownRequestError): AppError {
  switch (err.code) {
    case 'P2002': {
      const target = (err.meta?.target as string[])?.join(', ') ?? 'field';
      return AppError.conflict(`Duplicate value for ${target}`, {
        [target]: [`A record with this ${target} already exists`],
      });
    }
    case 'P2021':
      return AppError.notFound('Database table not found. Run Laravel location migrations on the server.');
    case 'P2022':
      return AppError.internal('Database column mismatch. Update API or run migrations.');
    case 'P2032':
      return AppError.badRequest('Invalid value for a database field. Check numeric fields such as age_from and age_to.');
    case 'P2025':
      return AppError.notFound('Record not found');
    case 'P2003':
      return AppError.badRequest('Related record not found');
    case 'P2014':
      return AppError.badRequest('Invalid relation in request');
    default:
      return AppError.internal(
        config.env === 'production'
          ? 'Database operation failed'
          : `Database operation failed (${err.code})`
      );
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  // AppError — expected operational errors
  if (err instanceof AppError) {
    return sendError(res, err.message, err.statusCode, {
      code: err.code,
      errors: err.errors,
      meta: err.meta,
    });
  }

  // express-validator is handled in validate middleware

  // JWT errors
  if (err instanceof TokenExpiredError) {
    return sendError(res, 'Token expired', 401, { code: ErrorCode.AUTH_EXPIRED });
  }
  if (err instanceof JsonWebTokenError) {
    return sendError(res, 'Invalid token', 401, { code: ErrorCode.AUTH_INVALID });
  }

  // Multer upload errors
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `File too large. Maximum size is ${config.upload.maxMb}MB`
        : err.message;
    return sendError(res, message, 400, { code: ErrorCode.UPLOAD_ERROR });
  }
  if (err instanceof Error && err.message.includes('Only JPG')) {
    return sendError(res, err.message, 400, { code: ErrorCode.UPLOAD_ERROR });
  }

  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const appErr = handlePrismaError(err);
    if (config.env === 'development') console.error('[Prisma]', err.code, err.meta);
    return sendError(res, appErr.message, appErr.statusCode, {
      code: appErr.code,
      errors: appErr.errors,
      meta: { prismaCode: err.code },
    });
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    return sendError(res, 'Invalid database query', 400, { code: ErrorCode.DATABASE_ERROR });
  }

  // JSON parse errors
  if (err instanceof SyntaxError && 'body' in err) {
    return sendError(res, 'Invalid JSON in request body. Check syntax — keys must be quoted strings.', 400, {
      code: ErrorCode.VALIDATION_ERROR,
      errors: { body: ['Request body must be valid JSON'] },
    });
  }

  // CORS errors
  if (err instanceof Error && err.message === 'Not allowed by CORS') {
    return sendError(res, 'Origin not allowed by CORS policy', 403, { code: ErrorCode.FORBIDDEN });
  }

  // Unexpected errors
  console.error('[API Error]', err);
  const message = config.env === 'development' && err instanceof Error ? err.message : 'Internal server error';
  return sendError(res, message, 500, { code: ErrorCode.INTERNAL_ERROR });
}
