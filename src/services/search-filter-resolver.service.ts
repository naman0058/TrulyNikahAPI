import prisma from '../lib/prisma';

function isNumericId(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

async function resolveCountryValues(values: string[]): Promise<string[]> {
  const resolved = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    resolved.add(trimmed);

    if (isNumericId(trimmed)) continue;

    const byName = await prisma.country.findMany({
      where: { name: { contains: trimmed } },
      select: { id: true, name: true },
      take: 10,
    });
    for (const row of byName) {
      resolved.add(String(row.id));
      resolved.add(row.name);
    }
  }
  return unique([...resolved]);
}

async function resolveStateValues(values: string[]): Promise<string[]> {
  const resolved = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    resolved.add(trimmed);

    if (isNumericId(trimmed)) continue;

    const byName = await prisma.$queryRawUnsafe<Array<{ id: bigint | number; name: string }>>(
      'SELECT id, name FROM states WHERE name LIKE ? LIMIT 10',
      `%${trimmed}%`
    );
    for (const row of byName) {
      resolved.add(String(row.id));
      resolved.add(row.name);
    }
  }
  return unique([...resolved]);
}

async function resolveCityValues(values: string[]): Promise<string[]> {
  const resolved = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    resolved.add(trimmed);

    if (isNumericId(trimmed)) continue;

    const byName = await prisma.$queryRawUnsafe<Array<{ id: bigint | number; name: string }>>(
      'SELECT id, name FROM cities WHERE name LIKE ? LIMIT 10',
      `%${trimmed}%`
    );
    for (const row of byName) {
      resolved.add(String(row.id));
      resolved.add(row.name);
    }
  }
  return unique([...resolved]);
}

async function resolveSectValues(values: string[]): Promise<string[]> {
  const resolved = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    resolved.add(trimmed);

    if (isNumericId(trimmed)) continue;

    const byName = await prisma.caste.findMany({
      where: { caste: { contains: trimmed } },
      select: { id: true, caste: true },
      take: 10,
    });
    for (const row of byName) {
      resolved.add(String(row.id));
      if (row.caste) resolved.add(row.caste);
    }
  }
  return unique([...resolved]);
}

async function resolveCastValues(values: string[]): Promise<string[]> {
  const resolved = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    resolved.add(trimmed);

    if (isNumericId(trimmed)) continue;

    const byName = await prisma.subCaste.findMany({
      where: { subcaste: { contains: trimmed } },
      select: { id: true, subcaste: true },
      take: 10,
    });
    for (const row of byName) {
      resolved.add(String(row.id));
      if (row.subcaste) resolved.add(row.subcaste);
    }
  }
  return unique([...resolved]);
}

export type ResolvedSearchFilters = {
  country?: string[];
  state?: string[];
  city?: string[];
  sect?: string[];
  cast?: string[];
};

/** Accept filter values as numeric IDs or display labels (Sunni, India, Barelvi, etc.). */
export async function resolveSearchReferenceFilters(filters: {
  country?: string | string[];
  state?: string;
  city?: string;
  sect?: string | string[];
  cast?: string | string[];
}): Promise<ResolvedSearchFilters> {
  const toList = (value?: string | string[]) => {
    if (value == null || value === '') return undefined;
    const list = Array.isArray(value) ? value : [value];
    const cleaned = list.map((item) => String(item).trim()).filter(Boolean);
    return cleaned.length ? cleaned : undefined;
  };

  const country = toList(filters.country);
  const state = filters.state?.trim() ? [filters.state.trim()] : undefined;
  const city = filters.city?.trim() ? [filters.city.trim()] : undefined;
  const sect = toList(filters.sect);
  const cast = toList(filters.cast);

  const [countryValues, stateValues, cityValues, sectValues, castValues] = await Promise.all([
    country ? resolveCountryValues(country) : Promise.resolve(undefined),
    state ? resolveStateValues(state) : Promise.resolve(undefined),
    city ? resolveCityValues(city) : Promise.resolve(undefined),
    sect ? resolveSectValues(sect) : Promise.resolve(undefined),
    cast ? resolveCastValues(cast) : Promise.resolve(undefined),
  ]);

  return {
    country: countryValues,
    state: stateValues,
    city: cityValues,
    sect: sectValues,
    cast: castValues,
  };
}
