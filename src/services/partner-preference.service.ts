import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { heightStringToInches } from '../utils/helpers';
import { AppError } from '../utils/errors';
import { ALLOWED_PARTNER_FIELDS } from '../utils/validation';

function emptyToNull(value: unknown): string | null {
  if (value == null || value === '') return null;
  return String(value);
}

function parseOptionalAge(value: unknown, field: string): number | null {
  if (value == null || value === '') return null;
  const n = parseInt(String(value), 10);
  if (Number.isNaN(n) || n < 18 || n > 100) {
    throw AppError.badRequest('Validation failed', {
      [field]: [`${field} must be an integer between 18 and 100`],
    });
  }
  return n;
}

export function buildPartnerPreferencePayload(
  body: Record<string, unknown>
): Prisma.PartnerPreferenceUpdateInput {
  const data: Prisma.PartnerPreferenceUpdateInput = {};

  for (const field of ALLOWED_PARTNER_FIELDS) {
    if (!(field in body)) continue;

    switch (field) {
      case 'age_from':
      case 'age_to':
        data[field] = parseOptionalAge(body[field], field);
        break;
      case 'height_from':
      case 'height_to':
        if (body[field] == null || body[field] === '') {
          data[field] = null;
        } else {
          const inches = heightStringToInches(String(body[field]));
          if (inches === null) {
            throw AppError.badRequest('Invalid height format', {
              [field]: ['Use format like 5ft 4in'],
            });
          }
          data[field] = inches.toString();
        }
        break;
      default:
        data[field] = emptyToNull(body[field]);
    }
  }

  const ageFrom = data.age_from as number | null | undefined;
  const ageTo = data.age_to as number | null | undefined;
  if (ageFrom != null && ageTo != null && ageTo < ageFrom) {
    throw AppError.badRequest('Validation failed', {
      age_to: ['age_to must be greater than or equal to age_from'],
    });
  }

  return data;
}

export async function upsertPartnerPreference(userId: bigint, body: Record<string, unknown>) {
  const data = buildPartnerPreferencePayload(body);
  const existing = await prisma.partnerPreference.findFirst({ where: { user_id: userId } });

  if (Object.keys(data).length === 0) {
    if (existing) return existing;
    return prisma.partnerPreference.create({ data: { user_id: userId } });
  }

  if (existing) {
    return prisma.partnerPreference.update({ where: { id: existing.id }, data });
  }

  return prisma.partnerPreference.create({
    data: { user_id: userId, ...(data as Omit<Prisma.PartnerPreferenceUncheckedCreateInput, 'user_id'>) },
  });
}
