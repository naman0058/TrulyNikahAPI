import prisma from '../lib/prisma';
import { toPublicMediaUrl } from '../middleware/upload';
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

function isUserLikeRecord(record: Record<string, unknown>): boolean {
  if (record.id == null) return false;
  if (typeof record.member_id === 'string' && record.member_id.trim()) return true;
  return 'name' in record && ('gender' in record || 'age' in record || 'phone_verified' in record);
}

function collectUserIdsFromValue(value: unknown, userIds: Set<string>, seen: WeakSet<object>): void {
  if (value == null || typeof value !== 'object') return;
  if (value instanceof Date) return;
  if (seen.has(value as object)) return;
  seen.add(value as object);

  if (Array.isArray(value)) {
    for (const item of value) collectUserIdsFromValue(item, userIds, seen);
    return;
  }

  const record = value as Record<string, unknown>;
  if (isUserLikeRecord(record)) {
    userIds.add(String(record.id));
  }

  for (const nested of Object.values(record)) {
    if (nested && typeof nested === 'object') collectUserIdsFromValue(nested, userIds, seen);
  }
}

async function loadProfileImageMap(userIds: Set<string>): Promise<Map<string, string | null>> {
  if (!userIds.size) return new Map();

  const managers = await prisma.profileManager.findMany({
    where: { user_id: { in: [...userIds].map((id) => BigInt(id)) } },
    select: { user_id: true, profile_image: true },
  });

  return new Map(managers.map((row) => [row.user_id.toString(), toPublicMediaUrl(row.profile_image)]));
}

function resolveProfileImageForUser(
  record: Record<string, unknown>,
  imageMap: Map<string, string | null>
): string | null {
  if (record.profileManager && typeof record.profileManager === 'object') {
    const manager = record.profileManager as Record<string, unknown>;
    const fromManager = toPublicMediaUrl(manager.profile_image as string | null | undefined);
    if (fromManager) return fromManager;
  }

  const fromPicture = toPublicMediaUrl(record.profile_picture as string | null | undefined);
  if (fromPicture) return fromPicture;

  return imageMap.get(String(record.id)) ?? null;
}

function applyProfileImagesToValue(
  value: unknown,
  imageMap: Map<string, string | null>,
  seen: WeakSet<object>
): void {
  if (value == null || typeof value !== 'object') return;
  if (value instanceof Date) return;
  if (seen.has(value as object)) return;
  seen.add(value as object);

  if (Array.isArray(value)) {
    for (const item of value) applyProfileImagesToValue(item, imageMap, seen);
    return;
  }

  const record = value as Record<string, unknown>;
  if (isUserLikeRecord(record)) {
    record.profile_image = resolveProfileImageForUser(record, imageMap);
  }

  for (const nested of Object.values(record)) {
    if (nested && typeof nested === 'object') applyProfileImagesToValue(nested, imageMap, seen);
  }
}

/** Add top-level `profile_image` (full public URL) on every user object in a payload. */
export async function attachProfileImages<T>(payload: T): Promise<T> {
  if (payload == null) return payload;

  const userIds = new Set<string>();
  collectUserIdsFromValue(payload, userIds, new WeakSet());
  if (!userIds.size) return payload;

  const imageMap = await loadProfileImageMap(userIds);
  applyProfileImagesToValue(payload, imageMap, new WeakSet());
  return payload;
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

/** Recursively add *_name fields and profile_image on user objects in a payload. */
export async function enrichPayload<T>(payload: T): Promise<T> {
  if (payload == null) return payload;

  const bucket = emptyBucket();
  collectIdsFromValue(payload, bucket, new WeakSet());

  const hasIds = Object.values(bucket).some((set) => set.size > 0);
  let enriched: T = payload;

  if (hasIds) {
    const maps = await loadNameMaps(bucket);
    enriched = cloneAndEnrich(payload, maps, new WeakMap()) as T;
  }

  return attachProfileImages(enriched);
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
