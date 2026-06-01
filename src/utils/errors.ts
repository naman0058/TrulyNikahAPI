export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  AUTH_INVALID = 'AUTH_INVALID',
  AUTH_EXPIRED = 'AUTH_EXPIRED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT = 'RATE_LIMIT',
  UPLOAD_ERROR = 'UPLOAD_ERROR',
  PAYMENT_ERROR = 'PAYMENT_ERROR',
  OTP_ERROR = 'OTP_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  PHONE_NOT_VERIFIED = 'PHONE_NOT_VERIFIED',
  PROFILE_INCOMPLETE = 'PROFILE_INCOMPLETE',
  ACCOUNT_BLOCKED = 'ACCOUNT_BLOCKED',
  PREMIUM_REQUIRED = 'PREMIUM_REQUIRED',
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly errors?: Record<string, string[]>;
  public readonly meta?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode = 400,
    code: ErrorCode = ErrorCode.INTERNAL_ERROR,
    errors?: Record<string, string[]>,
    isOperational = true,
    meta?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    this.meta = meta;
    this.isOperational = isOperational;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message: string, errors?: Record<string, string[]>) {
    return new AppError(message, 400, ErrorCode.VALIDATION_ERROR, errors);
  }

  static unauthorized(message = 'Authentication required', code = ErrorCode.AUTH_REQUIRED) {
    return new AppError(message, 401, code);
  }

  static forbidden(message: string, code = ErrorCode.FORBIDDEN) {
    return new AppError(message, 403, code);
  }

  static notFound(message = 'Resource not found') {
    return new AppError(message, 404, ErrorCode.NOT_FOUND);
  }

  static conflict(message: string, errors?: Record<string, string[]>) {
    return new AppError(message, 409, ErrorCode.CONFLICT, errors);
  }

  static rateLimit(message: string, retryAfter?: number) {
    return new AppError(message, 429, ErrorCode.RATE_LIMIT, undefined, true, {
      retryAfter,
    });
  }

  static otpError(message: string) {
    return new AppError(message, 400, ErrorCode.OTP_ERROR);
  }

  static paymentError(message: string) {
    return new AppError(message, 400, ErrorCode.PAYMENT_ERROR);
  }

  static premiumRequired(message = 'Premium membership required') {
    return new AppError(message, 403, ErrorCode.PREMIUM_REQUIRED);
  }

  static internal(message = 'Internal server error') {
    return new AppError(message, 500, ErrorCode.INTERNAL_ERROR, undefined, false);
  }
}
