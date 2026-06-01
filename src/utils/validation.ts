import { NextFunction, Request, Response } from 'express';
import { body, param, query, validationResult, ValidationChain } from 'express-validator';
import { allowedValues, validationMessage, FieldOptionKey, FIELD_OPTIONS } from '../constants/fieldOptions';
import { AppError } from './errors';

export type ValidateOptions = {
  /** Reject request body keys not in this list (POST/PATCH/PUT) */
  allowedBody?: string[];
  /** Reject query keys not in this list (GET) */
  allowedQuery?: string[];
};

/** Collect unknown field errors for body or query */
export function unknownFieldErrors(
  source: Record<string, unknown> | undefined,
  allowed: string[]
): Record<string, string[]> {
  if (!source || typeof source !== 'object') return {};
  const errors: Record<string, string[]> = {};
  for (const key of Object.keys(source)) {
    if (!allowed.includes(key)) {
      errors[key] = [`Unknown field "${key}" is not allowed`];
    }
  }
  return errors;
}

/** Pick only allowed keys from body (strips unknown keys after validation) */
export function pickBody<T extends Record<string, unknown>>(body: Record<string, unknown>, allowed: string[]): T {
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out as T;
}

/** Reusable express-validator chains */
export const V = {
  positiveIntParam: (name: string, label = name) =>
    param(name)
      .trim()
      .notEmpty()
      .withMessage(`${label} is required`)
      .bail()
      .isInt({ min: 1 })
      .withMessage(`${label} must be a positive integer`),

  positiveIntBody: (name: string, label = name) =>
    body(name)
      .notEmpty()
      .withMessage(`${label} is required`)
      .bail()
      .isInt({ min: 1 })
      .withMessage(`${label} must be a positive integer`),

  optionalPositiveIntBody: (name: string) =>
    body(name).optional().isInt({ min: 1 }).withMessage(`${name} must be a positive integer`),

  nonEmptyString: (name: string, label = name) =>
    body(name).trim().notEmpty().withMessage(`${label} is required`),

  optionalString: (name: string) => body(name).optional().isString().trim(),

  email: (name = 'email') =>
    body(name).trim().isEmail().normalizeEmail().withMessage('Valid email is required'),

  phone10: (name = 'contact_number') =>
    body(name)
      .trim()
      .matches(/^\d{10}$/)
      .withMessage(`${name} must be exactly 10 digits`),

  otp: () => body('otp').trim().matches(/^\d{6}$/).withMessage('OTP must be 6 digits'),

  password: (name = 'password', min = 8) =>
    body(name).isLength({ min }).withMessage(`Password must be at least ${min} characters`),

  enumField: (name: FieldOptionKey, fieldLabel?: string) =>
    body(name)
      .trim()
      .notEmpty()
      .withMessage(`${fieldLabel ?? name} is required`)
      .bail()
      .isIn(allowedValues(name))
      .withMessage(validationMessage(name, fieldLabel ?? name)),

  optionalEnumField: (name: FieldOptionKey) =>
    body(name).optional().isIn(allowedValues(name)).withMessage(validationMessage(name)),

  pagination: () => [
    query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
  ],

  memberIdParam: () =>
    param('memberId').trim().notEmpty().withMessage('memberId is required'),

  slugParam: (name = 'slug') =>
    param(name).trim().notEmpty().withMessage(`${name} is required`),

  policyTypeParam: () =>
    param('type')
      .trim()
      .isIn(['privacy', 'terms', 'refund'])
      .withMessage('type must be one of: privacy, terms, refund'),
};

export function fieldOptionKeyParam() {
  const keys = Object.keys(FIELD_OPTIONS);
  return param('key')
    .trim()
    .notEmpty()
    .withMessage('key is required')
    .bail()
    .isIn(keys)
    .withMessage(`key must be one of: ${keys.join(', ')}`);
}

export const ALLOWED_FAMILY_FIELDS = [
  'family_type',
  'family_status',
  'native_state',
  'native_city',
  'father_name',
  'father_occupation',
  'mother_name',
  'mother_occupation',
  'brother',
  'brother_married',
  'sister',
  'sister_married',
  'about_family',
] as const;

export const ALLOWED_RELIGIOUS_FIELDS = ['religious', 'quran', 'namaz', 'roza', 'smoke', 'drink'] as const;

export const SEARCH_BODY_FIELDS = [
  'age_from',
  'age_to',
  'country',
  'state',
  'city',
  'marital_status',
  'sect',
  'cast',
  'page',
  'limit',
] as const;

export const CONTACT_ENQUIRY_FIELDS = ['name', 'email', 'phone', 'message'] as const;

export const ALLOWED_PARTNER_FIELDS = [
  'marital_status',
  'age_from',
  'age_to',
  'highest_education',
  'mother_tounge',
  'sect',
  'cast',
  'height_from',
  'height_to',
  'occupation',
  'country',
  'state',
  'city',
  'annual_income',
] as const;

export const AUTH_REGISTER_FIELDS = ['email', 'behalf', 'contact_number', 'password', 'fid'] as const;
export const AUTH_LOGIN_FIELDS = ['email', 'password'] as const;
export const AUTH_CHECK_FIELDS = ['email', 'contact_number'] as const;
export const AUTH_CHANGE_PASSWORD_FIELDS = ['password', 'password_confirmation'] as const;
export const AUTH_OTP_FIELDS = ['otp'] as const;
export const AUTH_INTERNAL_TOKEN_FIELDS = ['user_id'] as const;

export const PROFILE_STEP1_FIELDS = [
  'name',
  'dob',
  'gender',
  'height',
  'country',
  'states',
  'city',
  'family_with_groom',
  'weight',
  'pcountry',
  'pstate',
] as const;

export const PROFILE_STEP2_FIELDS = [
  'marital_status',
  'have_children',
  'mother_tounge',
  'sect',
  'cast',
  'employed_in',
  'occupation',
  'any_disability',
] as const;

export const PAYMENT_CREATE_FIELDS = ['amount', 'plan_id'] as const;
export const PAYMENT_VERIFY_FIELDS = [
  'razorpay_order_id',
  'razorpay_payment_id',
  'razorpay_signature',
  'plan_id',
  'vid',
  'plan_duration',
  'verified_contact',
  'amount',
] as const;

export const MESSAGE_SEND_FIELDS = ['receiver_id', 'message'] as const;
export const TRUST_BADGE_FIELDS = ['verification_type', 'image', 'image2'] as const;
export const UPLOAD_PHOTO_FIELDS = ['field'] as const;

/** Middleware: reject keys not in allowed list */
export function rejectUnknownBody(...allowed: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const errors = unknownFieldErrors(req.body as Record<string, unknown>, allowed);
    if (Object.keys(errors).length) return next(AppError.badRequest('Validation failed', errors));
    next();
  };
}

export function rejectUnknownQuery(...allowed: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const errors = unknownFieldErrors(req.query as Record<string, unknown>, allowed);
    if (Object.keys(errors).length) return next(AppError.badRequest('Validation failed', errors));
    next();
  };
}

/** Format express-validator results + optional unknown key checks */
export function formatValidationErrors(req: Request, options?: ValidateOptions): Record<string, string[]> | null {
  const formatted: Record<string, string[]> = {};

  if (options?.allowedBody) {
    Object.assign(formatted, unknownFieldErrors(req.body as Record<string, unknown>, options.allowedBody));
  }
  if (options?.allowedQuery) {
    Object.assign(formatted, unknownFieldErrors(req.query as Record<string, unknown>, options.allowedQuery));
  }

  validationResult(req)
    .array()
    .forEach((err) => {
      const field = 'path' in err ? String(err.path) : 'general';
      if (!formatted[field]) formatted[field] = [];
      formatted[field].push(err.msg);
    });

  return Object.keys(formatted).length ? formatted : null;
}

export type { ValidationChain };
