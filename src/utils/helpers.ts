import prisma from '../lib/prisma';
import { AppError } from './errors';

export async function generateMemberId(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const numericPart = Math.floor(Math.random() * 100_000_000)
      .toString()
      .padStart(8, '0');
    const memberId = `NM-${numericPart}`;
    const exists = await prisma.user.findUnique({ where: { member_id: memberId } });
    if (!exists) return memberId;
  }
  throw new Error('Unable to generate unique member ID');
}

export function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function isProfileComplete(user: {
  height: string | null;
  country: string | null;
  marital_status: string | null;
  mother_tounge: string | null;
  sect: string | null;
  cast: string | null;
  employed_in: string | null;
  occupation: string | null;
}): boolean {
  return Boolean(
    user.height &&
      user.country &&
      user.marital_status &&
      user.mother_tounge &&
      user.sect &&
      user.cast &&
      user.employed_in &&
      user.occupation
  );
}

const PROFILE_COMPLETION_FIELDS = [
  'name',
  'dob',
  'gender',
  'height',
  'country',
  'state',
  'city',
  'marital_status',
  'mother_tounge',
  'sect',
  'cast',
  'employed_in',
  'occupation',
  'highest_education',
  'about_us',
  'phone_verified',
] as const;

export function getProfileCompletion(user: Record<string, unknown>) {
  const filled = PROFILE_COMPLETION_FIELDS.filter((field) => {
    const value = user[field];
    if (typeof value === 'boolean') return value;
    return value !== null && value !== undefined && String(value).trim() !== '';
  });

  const percentage = Math.round((filled.length / PROFILE_COMPLETION_FIELDS.length) * 100);
  const missing = PROFILE_COMPLETION_FIELDS.filter((field) => !filled.includes(field));

  return {
    percentage,
    complete: isProfileComplete(user as never),
    filledCount: filled.length,
    totalFields: PROFILE_COMPLETION_FIELDS.length,
    missingFields: missing,
  };
}

export function maskPhone(contactNumber: string): string {
  const number = contactNumber.replace(/\D/g, '');
  if (number.length < 10) return contactNumber;
  return `+${number.slice(0, 3)}${'∗'.repeat(5)}${number.slice(-2)}`;
}

export function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const [name, domain] = parts;
  const domainParts = domain.split('.');
  const domainName = domainParts[0] ?? '';
  const domainExt = domainParts.slice(1).join('.');
  const nameMasked = name.charAt(0) + '*'.repeat(Math.max(name.length - 1, 1));
  const domainMasked = domainName.charAt(0) + '*'.repeat(Math.max(domainName.length - 1, 1));
  return `${nameMasked}@${domainMasked}${domainExt ? '.' + domainExt : ''}`;
}

export function heightStringToInches(heightStr: string): number | null {
  const normalized = heightStr.toLowerCase().trim();
  const match = normalized.match(/(?:(\d+)\s*(?:ft|f|'|’))?\s*(?:(\d+)\s*(?:in|"))?/i);
  if (!match) return null;
  const feet = match[1] ? parseInt(match[1], 10) : 0;
  const inches = match[2] ? parseInt(match[2], 10) : 0;
  return feet * 12 + inches;
}

export function inchesToHeightString(inches: number): string {
  const feet = Math.floor(inches / 12);
  const inch = inches % 12;
  return inch === 0 ? `${feet}ft` : `${feet}ft ${inch}in`;
}

export function generateUniqueInvoiceNumber(): string {
  const num = Math.floor(Math.random() * 999_999) + 1;
  return `INV-${num.toString().padStart(6, '0')}`;
}

/** Express 5 params can be string | string[] — normalize to string. */
export function routeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

/** Parse numeric path/query param — throws AppError on invalid input */
export function parseBigIntId(value: string | string[] | undefined, fieldName: string): bigint {
  const raw = routeParam(value).trim();
  if (!/^\d+$/.test(raw)) {
    throw AppError.badRequest('Validation failed', {
      [fieldName]: [`${fieldName} must be a positive integer`],
    });
  }
  return BigInt(raw);
}

export const PUBLIC_USER_SELECT = {
  id: true,
  member_id: true,
  name: true,
  gender: true,
  age: true,
  height: true,
  country: true,
  state: true,
  city: true,
  marital_status: true,
  mother_tounge: true,
  sect: true,
  cast: true,
  highest_education: true,
  occupation: true,
  employed_in: true,
  about_us: true,
  status: true,
  profile_visibility: true,
  created_at: true,
} as const;
