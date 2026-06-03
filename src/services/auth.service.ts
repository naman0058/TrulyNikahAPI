import prisma from '../lib/prisma';
import { hashPassword, verifyPassword } from '../lib/bcrypt';
import { signUserToken } from '../lib/jwt';
import { createAndSendOtp, createAndSendOtpForMobile, verifyOtpForUser, verifyMobileOtp, canResendOtp } from './otp.service';
import { calculateAge, generateMemberId, isProfileComplete } from '../utils/helpers';
import { AppError, ErrorCode } from '../utils/errors';

export async function registerUser(input: {
  email: string;
  behalf: string;
  contact_number: string;
  password: string;
  firebase_uid?: string;
}) {
  const existingEmail = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (existingEmail) {
    throw AppError.badRequest('Email already registered', { email: ['Email already taken'] });
  }

  const existingPhone = await prisma.user.findFirst({ where: { contact_number: input.contact_number } });
  if (existingPhone) {
    throw AppError.badRequest('Phone already registered', { contact_number: ['Phone number already taken'] });
  }

  const memberId = await generateMemberId();
  const hashed = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      member_id: memberId,
      email: input.email.toLowerCase(),
      behalf_of: input.behalf,
      contact_number: input.contact_number,
      firebase_uid: input.firebase_uid,
      phone_verified: false,
      status: 'pending',
      profile_visibility: 'everyone',
      password: hashed,
    },
  });

  const otpSent = await createAndSendOtp(user.id, input.contact_number);
  if (!otpSent) throw AppError.internal('Failed to send OTP. Please try again.');

  const token = signUserToken(user.id, user.email);
  return { user, token, otpSent: true };
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) throw AppError.unauthorized('Invalid credentials', ErrorCode.AUTH_INVALID);

  const valid = await verifyPassword(password, user.password);
  if (!valid) throw AppError.unauthorized('Invalid credentials', ErrorCode.AUTH_INVALID);

  assertUserCanLogin(user);

  await prisma.user.update({
    where: { id: user.id },
    data: { last_login_at: new Date() },
  });

  const token = signUserToken(user.id, user.email);
  return { user, token };
}

function assertUserCanLogin(user: { status: string }) {
  if (user.status === 'block' || user.status === 'deleted') {
    throw AppError.forbidden('Your account is blocked or deleted', ErrorCode.ACCOUNT_BLOCKED);
  }
}

/** Mobile app: send OTP (same response for new + existing — no account hint) */
export async function sendMobileAuthOtp(contact_number: string) {
  const user = await prisma.user.findFirst({ where: { contact_number } });
  if (user) assertUserCanLogin(user);

  const cooldown = await canResendOtp(contact_number);
  if (!cooldown.allowed) {
    throw AppError.rateLimit('OTP can be sent only after cooldown period', cooldown.retryAfter);
  }

  const sent = await createAndSendOtpForMobile(contact_number, user?.id);
  if (!sent) throw AppError.internal('Failed to send OTP. Please try again.');

  return { contact_number, nextStep: 'verify_otp' as const };
}

export type MobileAuthVerifyResult =
  | {
      accountExists: true;
      accountStatus: 'existing';
      nextStep: 'dashboard' | 'complete_profile';
      contact_number: string;
      phoneVerified: boolean;
      token: string;
      user: Awaited<ReturnType<typeof prisma.user.findUnique>>;
    }
  | {
      accountExists: false;
      accountStatus: 'new';
      nextStep: 'register';
      contact_number: string;
      phoneVerified: boolean;
    };

/** Mobile app: verify OTP — then return whether account exists */
export async function verifyMobileAuthOtp(
  contact_number: string,
  otp: string
): Promise<MobileAuthVerifyResult> {
  const otpResult = await verifyMobileOtp(contact_number, otp);
  if (!otpResult.ok) throw AppError.otpError(otpResult.reason);

  const user = await prisma.user.findFirst({ where: { contact_number } });

  if (!user) {
    return {
      accountExists: false,
      accountStatus: 'new',
      nextStep: 'register',
      contact_number,
      phoneVerified: true,
    };
  }

  assertUserCanLogin(user);

  await prisma.user.update({
    where: { id: user.id },
    data: { last_login_at: new Date() },
  });

  const updated = await prisma.user.findUnique({ where: { id: user.id } });
  if (!updated) throw AppError.notFound('User not found');

  const token = signUserToken(updated.id, updated.email);
  const profileComplete = isProfileComplete(updated);

  return {
    accountExists: true,
    accountStatus: 'existing',
    nextStep: profileComplete ? 'dashboard' : 'complete_profile',
    contact_number,
    phoneVerified: updated.phone_verified,
    token,
    user: updated,
  };
}

/** Send OTP to registered mobile for passwordless login */
export async function sendLoginOtp(contact_number: string) {
  return sendMobileAuthOtp(contact_number);
}

/** Verify OTP and issue JWT (mobile login — existing users only) */
export async function loginWithOtp(contact_number: string, otp: string) {
  const result = await verifyMobileAuthOtp(contact_number, otp);
  if (!result.accountExists) {
    throw AppError.badRequest('No account with this mobile. Please register.', {
      contact_number: ['Account does not exist — use mobile verify flow or register'],
    });
  }
  return { user: result.user!, token: result.token };
}

export async function issueInternalToken(userId: bigint) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound('User not found');
  return signUserToken(user.id, user.email);
}

export async function checkAvailability(email: string, contact_number: string) {
  const emailTaken = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  const phoneTaken = await prisma.user.findFirst({ where: { contact_number } });
  return { emailAvailable: !emailTaken, phoneAvailable: !phoneTaken };
}

export async function deleteUserAccount(userId: bigint) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound('User not found');

  return prisma.user.update({
    where: { id: userId },
    data: { status: 'deleted' },
  });
}

export async function saveProfileStep1(
  userId: bigint,
  data: {
    name: string;
    dob: string;
    gender: 'male' | 'female';
    height: string;
    country: string;
    states: string;
    city: string;
    family_with_groom?: boolean;
    weight?: string;
    pcountry?: string;
    pstate?: string;
  }
) {
  const age = calculateAge(data.dob);

  if (data.gender === 'female' && age < 18) {
    throw AppError.badRequest('Female must be at least 18 years old', {
      dob: ['Female must be at least 18 years old.'],
    });
  }
  if (data.gender === 'male' && age < 21) {
    throw AppError.badRequest('Male must be at least 21 years old', {
      dob: ['Male must be at least 21 years old.'],
    });
  }

  const { heightStringToInches } = await import('../utils/helpers');
  const heightInches = heightStringToInches(data.height);
  if (heightInches === null) {
    throw AppError.badRequest('Invalid height format', { height: ['Use format like 5ft 4in'] });
  }

  const baseUpdate = {
    name: data.name,
    dob: data.dob,
    gender: data.gender,
    age: age.toString(),
    height: heightInches.toString(),
    country: data.country,
    state: data.states,
    city: data.city,
    with_family: data.family_with_groom ?? false,
    weight: data.weight,
  };

  if (data.family_with_groom) {
    return prisma.user.update({ where: { id: userId }, data: baseUpdate });
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      ...baseUpdate,
      parent_country: data.pcountry,
      parent_state: data.pstate,
    },
  });
}

export async function saveProfileStep2(
  userId: bigint,
  data: {
    marital_status: string;
    have_children?: string;
    mother_tounge: string;
    sect: string;
    cast: string;
    employed_in: string;
    occupation: string;
    any_disability: string;
  }
) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      marital_status: data.marital_status,
      have_children: data.have_children,
      mother_tounge: data.mother_tounge,
      sect: data.sect,
      cast: data.cast,
      employed_in: data.employed_in,
      occupation: data.occupation,
      any_disability: data.any_disability,
    },
  });
}

export function sanitizeUser(user: {
  id: bigint;
  password: string;
  remember_token?: string | null;
  [key: string]: unknown;
}) {
  const { password: _p, remember_token: _r, ...safe } = user;
  return safe;
}
