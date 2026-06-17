import prisma from '../lib/prisma';
import { sanitizeUser } from './auth.service';

export const DISPLAY_NOT_AVAILABLE = 'not available';

/** ID field on user/partner records → resolved label field added to API responses */
export const DISPLAY_ID_FIELD_MAP = {
  country: 'country_name',
  state: 'state_name',
  city: 'city_name',
  parent_country: 'parent_country_name',
  parent_state: 'parent_state_name',
  parent_city: 'parent_city_name',
  sect: 'sect_name',
  cast: 'cast_name',
} as const;

type DisplayIdField = keyof typeof DISPLAY_ID_FIELD_MAP;
type NameMapKey = 'countries' | 'states' | 'cities' | 'sects' | 'casts';

type NameMaps = Record<NameMapKey, Map<string, string>>;

type IdBucket = Record<NameMapKey, Set<string>>;

const FIELD_TO_MAP: Record<DisplayIdField, NameMapKey> = {
  country: 'countries',
  parent_country: 'countries',
  state: 'states',
  parent_state: 'states',
  city: 'cities',
  parent_city: 'cities',
  sect: 'sects',
  cast: 'casts',
};

function emptyBucket(): IdBucket {
  return {
    countries: new Set(),
    states: new Set(),
    cities: new Set(),
    sects: new Set(),
    casts: new Set(),
  };
}

function parseOptionalId(value: unknown): bigint | null {
  if (value == null || value === '') return null;
  const trimmed = String(value).trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return BigInt(trimmed);
}

function resolveName(id: bigint | null, map: Map<string, string>): string {
  if (id == null) return DISPLAY_NOT_AVAILABLE;
  return map.get(id.toString()) ?? DISPLAY_NOT_AVAILABLE;
}

function collectIdsFromValue(value: unknown, bucket: IdBucket, seen: WeakSet<object>): void {
  if (value == null || typeof value !== 'object') return;
  if (value instanceof Date) return;
  if (seen.has(value as object)) return;
  seen.add(value as object);

  if (Array.isArray(value)) {
    for (const item of value) collectIdsFromValue(item, bucket, seen);
    return;
  }

  const record = value as Record<string, unknown>;
  for (const idField of Object.keys(DISPLAY_ID_FIELD_MAP) as DisplayIdField[]) {
    if (!(idField in record)) continue;
    const id = parseOptionalId(record[idField]);
    if (id != null) bucket[FIELD_TO_MAP[idField]].add(id.toString());
  }

  for (const nested of Object.values(record)) {
    if (nested && typeof nested === 'object') collectIdsFromValue(nested, bucket, seen);
  }
}

async function lookupByIds(
  table: 'countries' | 'states' | 'cities',
  ids: Set<string>
): Promise<Map<string, string>> {
  if (!ids.size) return new Map();
  const numericIds = [...ids].map((id) => Number(id));
  const placeholders = numericIds.map(() => '?').join(', ');
  const rows = await prisma.$queryRawUnsafe<Array<{ id: bigint | number; name: string }>>(
    `SELECT id, name FROM ${table} WHERE id IN (${placeholders})`,
    ...numericIds
  );
  return new Map(rows.map((r) => [String(r.id), r.name]));
}

async function lookupCasteNames(ids: Set<string>): Promise<Map<string, string>> {
  if (!ids.size) return new Map();
  const numericIds = [...ids].map((id) => Number(id));
  const placeholders = numericIds.map(() => '?').join(', ');
  const rows = await prisma.$queryRawUnsafe<Array<{ id: bigint | number; name: string }>>(
    `SELECT id, caste AS name FROM castes WHERE id IN (${placeholders})`,
    ...numericIds
  );
  return new Map(rows.map((r) => [String(r.id), r.name]));
}

async function lookupSubCasteNames(ids: Set<string>): Promise<Map<string, string>> {
  if (!ids.size) return new Map();
  const numericIds = [...ids].map((id) => Number(id));
  const placeholders = numericIds.map(() => '?').join(', ');
  const rows = await prisma.$queryRawUnsafe<Array<{ id: bigint | number; name: string }>>(
    `SELECT id, subcaste AS name FROM sub_castes WHERE id IN (${placeholders})`,
    ...numericIds
  );
  return new Map(rows.map((r) => [String(r.id), r.name]));
}

async function loadNameMaps(bucket: IdBucket): Promise<NameMaps> {
  const [countries, states, cities, sects, casts] = await Promise.all([
    lookupByIds('countries', bucket.countries),
    lookupByIds('states', bucket.states),
    lookupByIds('cities', bucket.cities),
    lookupCasteNames(bucket.sects),
    lookupSubCasteNames(bucket.casts),
  ]);
  return { countries, states, cities, sects, casts };
}

function normalizeLegacyUserFields(record: Record<string, unknown>): void {
  if (!('profile_visibility' in record)) return;
  const value = record.profile_visibility;
  if (value == null || value === '') {
    record.profile_visibility = 'everyone';
  }
}

function applyDisplayNames(record: Record<string, unknown>, maps: NameMaps): void {
  normalizeLegacyUserFields(record);
  for (const [idField, nameField] of Object.entries(DISPLAY_ID_FIELD_MAP) as [DisplayIdField, string][]) {
    if (!(idField in record)) continue;
    const mapKey = FIELD_TO_MAP[idField];
    record[nameField] = resolveName(parseOptionalId(record[idField]), maps[mapKey]);
  }
}

function cloneAndEnrich(value: unknown, maps: NameMaps, seen: WeakMap<object, unknown>): unknown {
  if (value == null || typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (seen.has(value as object)) return seen.get(value as object);

  if (Array.isArray(value)) {
    const arr = value.map((item) => cloneAndEnrich(item, maps, seen));
    seen.set(value, arr);
    return arr;
  }

  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  seen.set(value, out);

  for (const [key, val] of Object.entries(obj)) {
    out[key] = cloneAndEnrich(val, maps, seen);
  }

  applyDisplayNames(out, maps);
  return out;
}

/** Recursively add *_name fields anywhere country/state/city/sect/cast IDs appear in a payload. */
export async function enrichPayload<T>(payload: T): Promise<T> {
  if (payload == null) return payload;

  const bucket = emptyBucket();
  collectIdsFromValue(payload, bucket, new WeakSet());

  const hasIds = Object.values(bucket).some((set) => set.size > 0);
  if (!hasIds) return payload;

  const maps = await loadNameMaps(bucket);
  return cloneAndEnrich(payload, maps, new WeakMap()) as T;
}

/** Sanitize user + add display names (auth / profile updates). */
export async function enrichUserForClient(user: {
  id: bigint;
  password: string;
  remember_token?: string | null;
  [key: string]: unknown;
}) {
  return enrichPayload(sanitizeUser(user));
}

/** Strip password/remember_token when present, then enrich nested ID fields. */
export async function enrichSafeUser<T extends Record<string, unknown>>(user: T) {
  const { password: _p, remember_token: _r, ...safe } = user as T & {
    password?: string;
    remember_token?: string | null;
  };
  return enrichPayload(safe);
}
