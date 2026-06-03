import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../utils/errors';

export type StateRow = { id: bigint; name: string; country_id: bigint };
export type CityRow = { id: bigint; name: string; state_id: bigint };

function isSchemaMismatchError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return ['P2021', 'P2022', 'P2010'].includes(err.code);
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("doesn't exist") ||
      msg.includes('unknown column') ||
      msg.includes('does not exist') ||
      (msg.includes('table') && msg.includes("doesn't exist"))
    );
  }
  return false;
}

function toBigIntRow<T extends { id: bigint | number; name: string }>(r: T): T & { id: bigint } {
  return { ...r, id: BigInt(r.id) };
}

/** Parameterized raw query (works across Prisma/MySQL versions; avoids BigInt binding issues). */
async function queryStatesByCountry(countryId: bigint): Promise<StateRow[]> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ id: bigint | number; name: string; country_id: bigint | number }>
  >(
    'SELECT id, name, country_id FROM states WHERE country_id = ? ORDER BY name ASC',
    Number(countryId)
  );
  return rows.map((r) => ({
    ...toBigIntRow(r),
    country_id: BigInt(r.country_id),
  }));
}

async function queryCitiesByState(stateId: bigint): Promise<CityRow[]> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ id: bigint | number; name: string; state_id: bigint | number }>
  >(
    'SELECT id, name, state_id FROM cities WHERE state_id = ? ORDER BY name ASC',
    Number(stateId)
  );
  return rows.map((r) => ({
    ...toBigIntRow(r),
    state_id: BigInt(r.state_id),
  }));
}

/** States by country — raw SQL (Laravel-compatible). */
export async function findStatesByCountryId(countryId: bigint): Promise<StateRow[]> {
  try {
    return await queryStatesByCountry(countryId);
  } catch (err) {
    if (!isSchemaMismatchError(err)) throw err;
    try {
      return await prisma.state.findMany({
        where: { country_id: countryId },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, country_id: true },
      });
    } catch (inner) {
      if (isSchemaMismatchError(inner)) {
        throw AppError.notFound(
          'States table missing or empty. Import deploy/sql/location-setup.sql on this database.'
        );
      }
      throw inner;
    }
  }
}

/** Cities by state */
export async function findCitiesByStateId(stateId: bigint): Promise<CityRow[]> {
  try {
    return await queryCitiesByState(stateId);
  } catch (err) {
    if (!isSchemaMismatchError(err)) throw err;
    try {
      return await prisma.city.findMany({
        where: { state_id: stateId },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, state_id: true },
      });
    } catch (inner) {
      if (isSchemaMismatchError(inner)) {
        throw AppError.notFound(
          'Cities table missing or empty. Add city rows for this state in the database.'
        );
      }
      throw inner;
    }
  }
}

export async function countryExists(countryId: bigint): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: bigint | number }>>(
    'SELECT id FROM countries WHERE id = ? LIMIT 1',
    Number(countryId)
  );
  return rows.length > 0;
}

export async function stateExists(stateId: bigint): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: bigint | number }>>(
    'SELECT id FROM states WHERE id = ? LIMIT 1',
    Number(stateId)
  );
  return rows.length > 0;
}

/** Used by GET /health to verify DB + deploy. */
export async function countStatesForCountry(countryId: number): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ c: bigint | number }>>(
    'SELECT COUNT(*) AS c FROM states WHERE country_id = ?',
    countryId
  );
  return Number(rows[0]?.c ?? 0);
}
