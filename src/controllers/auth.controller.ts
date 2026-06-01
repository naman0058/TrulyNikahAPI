import { body } from 'express-validator';
import { AuthRequest, asyncHandler, authenticate, validateBody } from '../middleware';
import {
  AUTH_CHANGE_PASSWORD_FIELDS,
  AUTH_CHECK_FIELDS,
  AUTH_INTERNAL_TOKEN_FIELDS,
  AUTH_LOGIN_FIELDS,
  AUTH_OTP_FIELDS,
  AUTH_REGISTER_FIELDS,
  PROFILE_STEP1_FIELDS,
  PROFILE_STEP2_FIELDS,
  V,
} from '../utils/validation';
import {
  checkAvailability,
  deleteUserAccount,
  issueInternalToken,
  loginUser,
  registerUser,
  sanitizeUser,
  saveProfileStep1,
  saveProfileStep2,
} from '../services/auth.service';
import { createAndSendOtp, verifyOtpForUser, canResendOtp } from '../services/otp.service';
import { getProfileCompletion, isProfileComplete } from '../utils/helpers';
import { sendSuccess, serialize } from '../utils/response';
import { hashPassword } from '../lib/bcrypt';
import prisma from '../lib/prisma';
import config from '../config';
import { AppError } from '../utils/errors';

export const register = [
  validateBody([...AUTH_REGISTER_FIELDS], [
    V.email(),
    V.nonEmptyString('behalf'),
    V.phone10('contact_number'),
    V.password(),
    body('fid').optional().isString().trim(),
  ]),
  asyncHandler(async (req, res) => {
    const result = await registerUser({
      email: req.body.email,
      behalf: req.body.behalf,
      contact_number: req.body.contact_number,
      password: req.body.password,
      firebase_uid: req.body.fid,
    });
    return sendSuccess(
      res,
      'Registration successful. OTP sent to your phone.',
      {
        token: result.token,
        user: serialize(sanitizeUser(result.user as never)),
        nextStep: 'otp_verification',
      },
      201
    );
  }),
];

export const login = [
  validateBody([...AUTH_LOGIN_FIELDS], [V.email(), V.nonEmptyString('password', 'password')]),
  asyncHandler(async (req, res) => {
    const result = await loginUser(req.body.email, req.body.password);
    const user = result.user;
    return sendSuccess(res, 'Login successful', {
      token: result.token,
      user: serialize(sanitizeUser(user as never)),
      onboarding: {
        phoneVerified: user.phone_verified,
        profileComplete: isProfileComplete(user),
        status: user.status,
        completion: getProfileCompletion(user as never),
      },
    });
  }),
];

export const checkEmail = [
  validateBody([...AUTH_CHECK_FIELDS], [
    V.email(),
    body('contact_number').matches(/^\+?\d{10,15}$/).withMessage('contact_number must be 10-15 digits'),
  ]),
  asyncHandler(async (req, res) => {
    const result = await checkAvailability(req.body.email, req.body.contact_number);
    return sendSuccess(res, 'Availability checked', result);
  }),
];

export const me = [
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = req.user!;
    return sendSuccess(res, 'Profile fetched', {
      user: serialize(sanitizeUser(user as never)),
      onboarding: {
        phoneVerified: user.phone_verified,
        profileComplete: isProfileComplete(user),
        status: user.status,
        completion: getProfileCompletion(user as never),
      },
    });
  }),
];

export const logout = [
  authenticate,
  asyncHandler(async (_req, res) => {
    return sendSuccess(res, 'Logged out successfully');
  }),
];

export const deleteAccount = [
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    await deleteUserAccount(req.userId!);
    return sendSuccess(res, 'Account deleted successfully');
  }),
];

export const changePassword = [
  authenticate,
  validateBody([...AUTH_CHANGE_PASSWORD_FIELDS], [
    V.password(),
    body('password_confirmation')
      .custom((val, { req }) => val === req.body.password)
      .withMessage('password_confirmation must match password'),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const hashed = await hashPassword(req.body.password);
    await prisma.user.update({ where: { id: req.userId! }, data: { password: hashed } });
    return sendSuccess(res, 'Password updated successfully');
  }),
];

export const verifyOtp = [
  authenticate,
  validateBody([...AUTH_OTP_FIELDS], [V.otp()]),
  asyncHandler(async (req: AuthRequest, res) => {
    const user = req.user!;
    const result = await verifyOtpForUser(user.id, user.contact_number!, req.body.otp);
    if (!result.ok) throw AppError.otpError(result.reason);
    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    return sendSuccess(res, 'OTP verified successfully', {
      user: serialize(sanitizeUser(updated as never)),
      nextStep: isProfileComplete(updated!) ? 'dashboard' : 'complete_profile',
    });
  }),
];

export const resendOtp = [
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = req.user!;
    const mobile = user.contact_number;
    if (!mobile || !/^\d{10}$/.test(mobile)) {
      throw AppError.badRequest('Invalid mobile number on account', { contact_number: ['Invalid mobile number'] });
    }
    const cooldown = await canResendOtp(mobile);
    if (!cooldown.allowed) {
      throw AppError.rateLimit('OTP can be sent only after cooldown period', cooldown.retryAfter);
    }
    const sent = await createAndSendOtp(user.id, mobile);
    if (!sent) throw AppError.internal('Failed to send OTP');
    return sendSuccess(res, 'OTP sent successfully');
  }),
];

export const profileStatus = [
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = req.user!;
    return sendSuccess(res, 'Profile status', {
      phoneVerified: user.phone_verified,
      profileComplete: isProfileComplete(user),
      missingFields: getMissingFields(user),
      completion: getProfileCompletion(user as never),
    });
  }),
];

export const profileStep1 = [
  authenticate,
  validateBody([...PROFILE_STEP1_FIELDS], [
    V.nonEmptyString('name'),
    V.nonEmptyString('dob'),
    body('gender').isIn(['male', 'female']).withMessage('gender must be male or female'),
    V.nonEmptyString('height'),
    V.nonEmptyString('country'),
    V.nonEmptyString('states'),
    V.nonEmptyString('city'),
    body('family_with_groom').optional().isBoolean(),
    body('weight').optional().isString().trim(),
    body('pcountry').optional().isString().trim(),
    body('pstate').optional().isString().trim(),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const user = await saveProfileStep1(req.userId!, req.body);
    return sendSuccess(res, 'Step 1 saved', { user: serialize(sanitizeUser(user as never)) });
  }),
];

export const profileStep2 = [
  authenticate,
  validateBody([...PROFILE_STEP2_FIELDS], [
    V.nonEmptyString('marital_status'),
    body('have_children').optional().isString().trim(),
    V.nonEmptyString('mother_tounge'),
    V.nonEmptyString('sect'),
    V.nonEmptyString('cast'),
    V.nonEmptyString('employed_in'),
    V.nonEmptyString('occupation'),
    V.nonEmptyString('any_disability'),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const user = await saveProfileStep2(req.userId!, req.body);
    return sendSuccess(res, 'Profile completed', {
      user: serialize(sanitizeUser(user as never)),
      nextStep: 'dashboard',
    });
  }),
];

/** Server-to-server token for Laravel session bridge */
export const internalToken = [
  validateBody([...AUTH_INTERNAL_TOKEN_FIELDS], [V.positiveIntBody('user_id')]),
  asyncHandler(async (req, res) => {
    const secret = req.headers['x-internal-secret'];
    if (!config.internalApiSecret || secret !== config.internalApiSecret) {
      throw AppError.unauthorized('Unauthorized');
    }
    const token = await issueInternalToken(BigInt(req.body.user_id));
    return sendSuccess(res, 'Token issued', { token });
  }),
];

function getMissingFields(user: {
  height: string | null;
  country: string | null;
  marital_status: string | null;
  mother_tounge: string | null;
  sect: string | null;
  cast: string | null;
  employed_in: string | null;
  occupation: string | null;
  phone_verified: boolean;
}) {
  const missing: string[] = [];
  if (!user.phone_verified) missing.push('phone_verified');
  if (!user.height) missing.push('height');
  if (!user.country) missing.push('country');
  if (!user.marital_status) missing.push('marital_status');
  if (!user.mother_tounge) missing.push('mother_tounge');
  if (!user.sect) missing.push('sect');
  if (!user.cast) missing.push('cast');
  if (!user.employed_in) missing.push('employed_in');
  if (!user.occupation) missing.push('occupation');
  return missing;
}
