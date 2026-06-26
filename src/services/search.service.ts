import { User } from '@prisma/client';
import prisma from '../lib/prisma';
import { SEARCH_AGE_BUCKETS, SEARCH_INCOME_BRACKETS } from '../constants/searchFilters';
import { heightStringToInches, PUBLIC_USER_SELECT } from '../utils/helpers';

const SEARCH_USER_SELECT = {
  ...PUBLIC_USER_SELECT,
  annual_income: true,
} as const;

export type SearchFiltersInput = {
  name?: string;
  age_from?: number;
  age_to?: number;
  age_range?: string;
  height_from?: string | number;
  height_to?: string | number;
  marital_status?: string | string[];
  sect?: string | string[];
  cast?: string | string[];
  country?: string | string[];
  state?: string;
  city?: string;
  highest_education?: string | string[];
  employed_in?: string | string[];
  mother_tounge?: string | string[];
  income_min_lakh?: number;
  income_max_lakh?: number;
  annual_income?: string | string[];
  page?: number;
  limit?: number;
};

function oppositeGender(gender: string | null | undefined): string {
  return gender === 'male' ? 'female' : 'male';
}

function toArray(value: string | string[] | undefined): string[] | undefined {
  if (value == null || value === '') return undefined;
  const list = Array.isArray(value) ? value : [value];
  const cleaned = list.map((item) => String(item).trim()).filter(Boolean);
  return cleaned.length ? cleaned : undefined;
}

function parseAgeRange(range: string): { from: number; to: number } | null {
  const bucket = SEARCH_AGE_BUCKETS.find((item) => item.value === range);
  if (bucket) return { from: bucket.age_from, to: bucket.age_to };

  if (range === '60+') return { from: 60, to: 100 };
  const match = range.match(/^(\d+)\s*-\s*(\d+)$/);
  if (match) return { from: parseInt(match[1], 10), to: parseInt(match[2], 10) };
  return null;
}

function resolveAgeBounds(filters: SearchFiltersInput): { from?: number; to?: number } {
  if (filters.age_range) {
    const parsed = parseAgeRange(String(filters.age_range).trim());
    if (parsed) return parsed;
  }
  return {
    from: filters.age_from != null ? Number(filters.age_from) : undefined,
    to: filters.age_to != null ? Number(filters.age_to) : undefined,
  };
}

function parseHeightToInches(value: string | number | undefined): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return value;
  const trimmed = String(value).trim();
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  return heightStringToInches(trimmed);
}

function profileHeightInches(height: string | null | undefined): number | null {
  if (!height) return null;
  const trimmed = height.trim();
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  return heightStringToInches(trimmed);
}

function normalizeMaritalValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function expandMaritalStatuses(values: string[]): string[] {
  const expanded = new Set<string>();
  for (const value of values) {
    expanded.add(value);
    const norm = normalizeMaritalValue(value);
    if (norm === 'never married') {
      expanded.add('Never Married');
      expanded.add('never married');
    }
    if (norm === 'separated') {
      expanded.add('separated');
      expanded.add('deparated');
    }
    if (norm === 'divorced') expanded.add('divorced');
    if (norm === 'widowed') expanded.add('widowed');
  }
  return [...expanded];
}

function incomeBracketForLabel(label: string | null | undefined) {
  if (!label) return null;
  return SEARCH_INCOME_BRACKETS.find((item) => item.value === label) ?? null;
}

function incomeOverlapsFilter(
  profileIncome: string | null | undefined,
  minLakh?: number,
  maxLakh?: number,
  exactValues?: string[]
): boolean {
  if (exactValues?.length) {
    if (!profileIncome) return false;
    return exactValues.includes(profileIncome);
  }

  if (minLakh == null && maxLakh == null) return true;

  const bracket = incomeBracketForLabel(profileIncome);
  if (!bracket) return false;

  const filterMin = minLakh ?? 0;
  const filterMax = maxLakh ?? 9999;
  return bracket.max_lakh >= filterMin && bracket.min_lakh <= filterMax;
}

function normalizeMotherTongue(value: string): string {
  return value.trim().toLowerCase();
}

function motherTongueMatches(profileValue: string | null | undefined, filters: string[]): boolean {
  if (!profileValue) return false;
  const profileNorm = normalizeMotherTongue(profileValue);
  return filters.some((item) => {
    const filterNorm = normalizeMotherTongue(item);
    return profileNorm === filterNorm || profileNorm.includes(filterNorm) || filterNorm.includes(profileNorm);
  });
}

async function excludedUserIds(userId: bigint): Promise<bigint[]> {
  const ignores = await prisma.ignore.findMany({
    where: { OR: [{ user_id: userId }, { ignored_user_id: userId }] },
    select: { user_id: true, ignored_user_id: true },
  });

  const ids = new Set<bigint>([userId]);
  for (const row of ignores) {
    ids.add(row.user_id);
    ids.add(row.ignored_user_id);
  }
  return [...ids];
}

function applyInFilter(where: Record<string, unknown>, field: string, values?: string[]) {
  if (!values?.length) return;
  where[field] = values.length === 1 ? values[0] : { in: values };
}

export async function searchProfiles(user: User, filters: SearchFiltersInput) {
  const pageNum = Math.max(1, Number(filters.page) || 1);
  const limitNum = Math.min(50, Math.max(1, Number(filters.limit) || 20));
  const skip = (pageNum - 1) * limitNum;

  const excludeIds = await excludedUserIds(user.id);
  const where: Record<string, unknown> = {
    gender: oppositeGender(user.gender),
    id: { notIn: excludeIds },
    status: { in: ['verified', 'premium', 'pending'] },
  };

  if (filters.name?.trim()) {
    where.name = { contains: filters.name.trim() };
  }

  applyInFilter(where, 'country', toArray(filters.country));
  if (filters.state) where.state = String(filters.state);
  if (filters.city) where.city = String(filters.city);

  const maritalStatuses = toArray(filters.marital_status);
  if (maritalStatuses) applyInFilter(where, 'marital_status', expandMaritalStatuses(maritalStatuses));

  applyInFilter(where, 'sect', toArray(filters.sect));
  applyInFilter(where, 'cast', toArray(filters.cast));
  applyInFilter(where, 'highest_education', toArray(filters.highest_education));
  applyInFilter(where, 'employed_in', toArray(filters.employed_in));

  const exactIncome = toArray(filters.annual_income);
  if (exactIncome?.length === 1) {
    where.annual_income = exactIncome[0];
  } else if (exactIncome && exactIncome.length > 1) {
    where.annual_income = { in: exactIncome };
  }

  const ageBounds = resolveAgeBounds(filters);
  const heightFrom = parseHeightToInches(filters.height_from);
  const heightTo = parseHeightToInches(filters.height_to);
  const motherTongues = toArray(filters.mother_tounge);
  const needsPostFilter =
    ageBounds.from != null ||
    ageBounds.to != null ||
    heightFrom != null ||
    heightTo != null ||
    Boolean(motherTongues?.length) ||
    filters.income_min_lakh != null ||
    filters.income_max_lakh != null ||
    Boolean(exactIncome && exactIncome.length > 1);

  const fetchSize = needsPostFilter ? Math.max(limitNum * 10, 200) : limitNum;
  const fetchSkip = needsPostFilter ? 0 : skip;

  let results = await prisma.user.findMany({
    where: where as never,
    select: SEARCH_USER_SELECT,
    skip: fetchSkip,
    take: fetchSize,
    orderBy: { created_at: 'desc' },
  });

  if (ageBounds.from != null || ageBounds.to != null) {
    const from = ageBounds.from ?? 18;
    const to = ageBounds.to ?? 100;
    results = results.filter((profile) => {
      const age = parseInt(profile.age ?? '0', 10);
      return age >= from && age <= to;
    });
  }

  if (heightFrom != null || heightTo != null) {
    const from = heightFrom ?? 0;
    const to = heightTo ?? 999;
    results = results.filter((profile) => {
      const inches = profileHeightInches(profile.height);
      if (inches == null) return false;
      return inches >= from && inches <= to;
    });
  }

  if (motherTongues?.length) {
    results = results.filter((profile) => motherTongueMatches(profile.mother_tounge, motherTongues));
  }

  if (filters.income_min_lakh != null || filters.income_max_lakh != null) {
    results = results.filter((profile) =>
      incomeOverlapsFilter(profile.annual_income, filters.income_min_lakh, filters.income_max_lakh)
    );
  }

  const total = results.length;
  const paginated = needsPostFilter ? results.slice(skip, skip + limitNum) : results;

  return { results: paginated, page: pageNum, limit: limitNum, total };
}
