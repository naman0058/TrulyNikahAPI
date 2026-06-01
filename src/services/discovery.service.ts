import prisma from '../lib/prisma';
import { PUBLIC_USER_SELECT } from '../utils/helpers';
import { User } from '@prisma/client';

function oppositeGender(gender: string | null | undefined): string {
  return gender === 'male' ? 'female' : 'male';
}

function buildIgnoredIds(userId: bigint) {
  return prisma.ignore.findMany({
    where: { OR: [{ user_id: userId }, { ignored_user_id: userId }] },
    select: { user_id: true, ignored_user_id: true },
  });
}

async function excludedUserIds(userId: bigint): Promise<bigint[]> {
  const ignores = await buildIgnoredIds(userId);
  const ids = new Set<bigint>([userId]);
  for (const row of ignores) {
    ids.add(row.user_id);
    ids.add(row.ignored_user_id);
  }
  return [...ids];
}

export async function getBestMatches(user: User, limit = 12) {
  const excludeIds = await excludedUserIds(user.id);
  const pref = await prisma.partnerPreference.findFirst({ where: { user_id: user.id } });

  const where: Record<string, unknown> = {
    gender: oppositeGender(user.gender),
    id: { notIn: excludeIds },
    status: { in: ['verified', 'premium'] },
  };

  if (pref) {
    if (pref.country) where.country = pref.country;
    if (pref.state) where.state = pref.state;
    if (pref.city) where.city = pref.city;
    if (pref.marital_status) where.marital_status = pref.marital_status;
    if (pref.sect) where.sect = pref.sect;
    if (pref.cast) where.cast = pref.cast;
    if (pref.mother_tounge) where.mother_tounge = pref.mother_tounge;
  }

  let matches = await prisma.user.findMany({
    where: where as never,
    select: PUBLIC_USER_SELECT,
    take: limit * 3,
    orderBy: { created_at: 'desc' },
  });

  if (pref?.age_from || pref?.age_to) {
    const from = pref.age_from ? parseInt(pref.age_from, 10) : 18;
    const to = pref.age_to ? parseInt(pref.age_to, 10) : 100;
    matches = matches.filter((p) => {
      const age = parseInt(p.age ?? '0', 10);
      return age >= from && age <= to;
    });
  }

  return matches.slice(0, limit);
}

export async function getNewProfiles(user: User, limit = 12) {
  const excludeIds = await excludedUserIds(user.id);

  return prisma.user.findMany({
    where: {
      gender: oppositeGender(user.gender),
      id: { notIn: excludeIds },
      status: { in: ['verified', 'premium', 'pending'] },
    },
    select: PUBLIC_USER_SELECT,
    take: limit,
    orderBy: { created_at: 'desc' },
  });
}
