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
      msg.includes("table") && msg.includes("doesn't exist")
    );
  }
  return false;
}

/** States by country — raw SQL first (Laravel-compatible, avoids Prisma schema drift) */
export async function findStatesByCountryId(countryId: bigint): Promise<StateRow[]> {
  try {
    return await findStatesByCountryIdRaw(countryId);
  } catch (err) {
    if (!isSchemaMismatchError(err)) throw err;
    return findStatesByCountryIdPrisma(countryId);
  }
}

async function findStatesByCountryIdRaw(countryId: bigint): Promise<StateRow[]> {
  const rows = await prisma.$queryRaw<Array<{ id: bigint | number; name: string; country_id: bigint | number }>>`
    SELECT id, name, country_id FROM states WHERE country_id = ${countryId} ORDER BY name ASC
  `;
  return rows.map((r) => ({
    id: BigInt(r.id),
    name: r.name,
    country_id: BigInt(r.country_id),
  }));
}

async function findStatesByCountryIdPrisma(countryId: bigint): Promise<StateRow[]> {
  try {
    return await prisma.state.findMany({
      where: { country_id: countryId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, country_id: true },
    });
  } catch (err) {
    if (isSchemaMismatchError(err)) {
      throw AppError.notFound(
        'States data is not available. Run Laravel migrations and StateSeeder on the database.'
      );
    }
    throw err;
  }
}

/** Cities by state */
export async function findCitiesByStateId(stateId: bigint): Promise<CityRow[]> {
  try {
    return await findCitiesByStateIdRaw(stateId);
  } catch (err) {
    if (!isSchemaMismatchError(err)) throw err;
    return findCitiesByStateIdPrisma(stateId);
  }
}

async function findCitiesByStateIdRaw(stateId: bigint): Promise<CityRow[]> {
  const rows = await prisma.$queryRaw<Array<{ id: bigint | number; name: string; state_id: bigint | number }>>`
    SELECT id, name, state_id FROM cities WHERE state_id = ${stateId} ORDER BY name ASC
  `;
  return rows.map((r) => ({
    id: BigInt(r.id),
    name: r.name,
    state_id: BigInt(r.state_id),
  }));
}

async function findCitiesByStateIdPrisma(stateId: bigint): Promise<CityRow[]> {
  try {
    return await prisma.city.findMany({
      where: { state_id: stateId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, state_id: true },
    });
  } catch (err) {
    if (isSchemaMismatchError(err)) {
      throw AppError.notFound(
        'Cities data is not available. Run Laravel migrations and city seeders on the database.'
      );
    }
    throw err;
  }
}

export async function countryExists(countryId: bigint): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ id: bigint | number }>>`
    SELECT id FROM countries WHERE id = ${countryId} LIMIT 1
  `;
  return rows.length > 0;
}

export async function stateExists(stateId: bigint): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ id: bigint | number }>>`
    SELECT id FROM states WHERE id = ${stateId} LIMIT 1
  `;
  return rows.length > 0;
}
