import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { PUBLIC_USER_SELECT } from '../utils/helpers';
import { AppError } from '../utils/errors';
import { assertSocialTarget } from './social.service';

export type GalleryRequestRow = {
  id: bigint;
  from_user_id: bigint;
  to_user_id: bigint;
  status: string;
  created_at: Date | null;
  updated_at: Date | null;
};

export type GalleryRequestWithUser = GalleryRequestRow & {
  toUser?: Record<string, unknown> | null;
  fromUser?: Record<string, unknown> | null;
};

const GALLERY_REQUEST_COLUMNS =
  'id, from_user_id, to_user_id, status, created_at, updated_at';

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
      msg.includes("doesn't exist in table")
    );
  }
  return false;
}

function isMissingGalleryTableError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2021') {
    return true;
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes('gallery_requests') && (msg.includes("doesn't exist") || msg.includes('does not exist'));
  }
  return false;
}

function galleryTableSetupError(): AppError {
  return AppError.internal(
    'Gallery requests table is missing or outdated. Run deploy/sql/gallery-requests-setup.sql on the database.'
  );
}

function mapGalleryRow(row: {
  id: bigint | number;
  from_user_id: bigint | number;
  to_user_id: bigint | number;
  status: string;
  created_at: Date | null;
  updated_at?: Date | null;
}): GalleryRequestRow {
  return {
    id: BigInt(row.id),
    from_user_id: BigInt(row.from_user_id),
    to_user_id: BigInt(row.to_user_id),
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at ?? null,
  };
}

async function queryGalleryRequestsRaw(
  filterColumn: 'from_user_id' | 'to_user_id',
  userId: bigint
): Promise<GalleryRequestRow[]> {
  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: bigint | number;
        from_user_id: bigint | number;
        to_user_id: bigint | number;
        status: string;
        created_at: Date | null;
        updated_at: Date | null;
      }>
    >(
      `SELECT ${GALLERY_REQUEST_COLUMNS}
       FROM gallery_requests
       WHERE ${filterColumn} = ?
       ORDER BY created_at DESC`,
      Number(userId)
    );
    return rows.map(mapGalleryRow);
  } catch (err) {
    if (isMissingGalleryTableError(err)) throw galleryTableSetupError();
    throw err;
  }
}

async function fetchGalleryRequests(
  direction: 'sent' | 'received',
  userId: bigint
): Promise<GalleryRequestRow[]> {
  const filterColumn = direction === 'sent' ? 'from_user_id' : 'to_user_id';

  try {
    const rows = await prisma.galleryRequest.findMany({
      where: { [filterColumn]: userId },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        from_user_id: true,
        to_user_id: true,
        status: true,
        created_at: true,
        updated_at: true,
      },
    });
    return rows.map((row) => ({
      ...row,
      status: String(row.status),
    }));
  } catch (err) {
    if (!isSchemaMismatchError(err)) throw err;
    return queryGalleryRequestsRaw(filterColumn, userId);
  }
}

async function fetchPublicUsers(userIds: bigint[]): Promise<Map<string, Record<string, unknown>>> {
  if (!userIds.length) return new Map();

  try {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: PUBLIC_USER_SELECT,
    });
    return new Map(users.map((user) => [user.id.toString(), user as Record<string, unknown>]));
  } catch (err) {
    if (!isSchemaMismatchError(err)) throw err;

    const placeholders = userIds.map(() => '?').join(', ');
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, member_id, name, gender, age, height, country, state, city,
              marital_status, mother_tounge, sect, cast, highest_education,
              occupation, employed_in, about_us, status, created_at
       FROM users
       WHERE id IN (${placeholders})`,
      ...userIds.map((id) => Number(id))
    );

    return new Map(
      rows.map((row) => [
        String(row.id),
        {
          ...row,
          id: BigInt(row.id as bigint | number),
          profile_visibility: 'everyone',
        },
      ])
    );
  }
}

async function attachUsers(
  rows: GalleryRequestRow[],
  userField: 'toUser' | 'fromUser',
  userIdField: 'to_user_id' | 'from_user_id'
): Promise<GalleryRequestWithUser[]> {
  const userIds = [...new Set(rows.map((row) => row[userIdField]))];
  const usersById = await fetchPublicUsers(userIds);

  return rows.map((row) => ({
    ...row,
    [userField]: usersById.get(row[userIdField].toString()) ?? null,
  }));
}

export async function listGalleryRequestsSent(userId: bigint): Promise<GalleryRequestWithUser[]> {
  const rows = await fetchGalleryRequests('sent', userId);
  return attachUsers(rows, 'toUser', 'to_user_id');
}

export async function listGalleryRequestsReceived(userId: bigint): Promise<GalleryRequestWithUser[]> {
  const rows = await fetchGalleryRequests('received', userId);
  return attachUsers(rows, 'fromUser', 'from_user_id');
}

/** Outgoing gallery requests that were accepted — users whose gallery you can view */
export async function listGalleryRequestsAccepted(userId: bigint): Promise<GalleryRequestWithUser[]> {
  const rows = await fetchGalleryRequestsAccepted(userId);
  return attachUsers(rows, 'toUser', 'to_user_id');
}

async function fetchGalleryRequestsAccepted(userId: bigint): Promise<GalleryRequestRow[]> {
  try {
    const rows = await prisma.galleryRequest.findMany({
      where: { from_user_id: userId, status: 'accepted' },
      orderBy: { updated_at: 'desc' },
      select: {
        id: true,
        from_user_id: true,
        to_user_id: true,
        status: true,
        created_at: true,
        updated_at: true,
      },
    });
    return rows.map((row) => ({
      ...row,
      status: String(row.status),
    }));
  } catch (err) {
    if (!isSchemaMismatchError(err)) throw err;

    try {
      const rows = await prisma.$queryRawUnsafe<
        Array<{
          id: bigint | number;
          from_user_id: bigint | number;
          to_user_id: bigint | number;
          status: string;
          created_at: Date | null;
          updated_at: Date | null;
        }>
      >(
        `SELECT ${GALLERY_REQUEST_COLUMNS}
         FROM gallery_requests
         WHERE from_user_id = ? AND status = 'accepted'
         ORDER BY updated_at DESC, created_at DESC`,
        Number(userId)
      );
      return rows.map(mapGalleryRow);
    } catch (rawErr) {
      if (isMissingGalleryTableError(rawErr)) throw galleryTableSetupError();
      throw rawErr;
    }
  }
}

/** Incoming gallery requests this user accepted — users who can view their gallery */
export async function listGalleryRequestsGrantedByMe(userId: bigint): Promise<GalleryRequestWithUser[]> {
  const rows = await fetchGalleryRequestsGrantedByMe(userId);
  return attachUsers(rows, 'fromUser', 'from_user_id');
}

async function fetchGalleryRequestsGrantedByMe(userId: bigint): Promise<GalleryRequestRow[]> {
  try {
    const rows = await prisma.galleryRequest.findMany({
      where: { to_user_id: userId, status: 'accepted' },
      orderBy: { updated_at: 'desc' },
      select: {
        id: true,
        from_user_id: true,
        to_user_id: true,
        status: true,
        created_at: true,
        updated_at: true,
      },
    });
    return rows.map((row) => ({
      ...row,
      status: String(row.status),
    }));
  } catch (err) {
    if (!isSchemaMismatchError(err)) throw err;

    try {
      const rows = await prisma.$queryRawUnsafe<
        Array<{
          id: bigint | number;
          from_user_id: bigint | number;
          to_user_id: bigint | number;
          status: string;
          created_at: Date | null;
          updated_at: Date | null;
        }>
      >(
        `SELECT ${GALLERY_REQUEST_COLUMNS}
         FROM gallery_requests
         WHERE to_user_id = ? AND status = 'accepted'
         ORDER BY updated_at DESC, created_at DESC`,
        Number(userId)
      );
      return rows.map(mapGalleryRow);
    } catch (rawErr) {
      if (isMissingGalleryTableError(rawErr)) throw galleryTableSetupError();
      throw rawErr;
    }
  }
}

async function findGalleryRequestPair(fromUserId: bigint, toUserId: bigint): Promise<GalleryRequestRow | null> {
  try {
    const row = await prisma.galleryRequest.findUnique({
      where: { from_user_id_to_user_id: { from_user_id: fromUserId, to_user_id: toUserId } },
    });
    return row ? { ...row, status: String(row.status) } : null;
  } catch (err) {
    if (!isSchemaMismatchError(err)) throw err;

    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: bigint | number;
        from_user_id: bigint | number;
        to_user_id: bigint | number;
        status: string;
        created_at: Date | null;
        updated_at: Date | null;
      }>
    >(
      `SELECT ${GALLERY_REQUEST_COLUMNS}
       FROM gallery_requests
       WHERE from_user_id = ? AND to_user_id = ?
       LIMIT 1`,
      Number(fromUserId),
      Number(toUserId)
    );
    return rows[0] ? mapGalleryRow(rows[0]) : null;
  }
}

async function insertGalleryRequest(fromUserId: bigint, toUserId: bigint): Promise<GalleryRequestRow> {
  try {
    const row = await prisma.galleryRequest.create({
      data: { from_user_id: fromUserId, to_user_id: toUserId, status: 'pending' },
    });
    return { ...row, status: String(row.status) };
  } catch (err) {
    if (!isSchemaMismatchError(err)) throw err;
    if (isMissingGalleryTableError(err)) throw galleryTableSetupError();

    await prisma.$executeRawUnsafe(
      `INSERT INTO gallery_requests (from_user_id, to_user_id, status, created_at)
       VALUES (?, ?, 'pending', NOW())`,
      Number(fromUserId),
      Number(toUserId)
    );

    const created = await findGalleryRequestPair(fromUserId, toUserId);
    if (!created) throw AppError.internal('Failed to create gallery request');
    return created;
  }
}

async function updateGalleryRequestStatus(id: bigint, status: 'pending' | 'accepted' | 'rejected'): Promise<GalleryRequestRow> {
  try {
    const row = await prisma.galleryRequest.update({
      where: { id },
      data: { status, updated_at: new Date() },
    });
    return { ...row, status: String(row.status) };
  } catch (err) {
    if (!isSchemaMismatchError(err)) throw err;

    await prisma.$executeRawUnsafe(
      `UPDATE gallery_requests SET status = ?, updated_at = NOW() WHERE id = ?`,
      status,
      Number(id)
    );

    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: bigint | number;
        from_user_id: bigint | number;
        to_user_id: bigint | number;
        status: string;
        created_at: Date | null;
        updated_at: Date | null;
      }>
    >(`SELECT ${GALLERY_REQUEST_COLUMNS} FROM gallery_requests WHERE id = ? LIMIT 1`, Number(id));

    if (!rows[0]) throw AppError.notFound('Gallery request not found');
    return mapGalleryRow(rows[0]);
  }
}

async function findPendingGalleryRequest(fromUserId: bigint, toUserId: bigint): Promise<GalleryRequestRow | null> {
  try {
    const row = await prisma.galleryRequest.findFirst({
      where: { from_user_id: fromUserId, to_user_id: toUserId, status: 'pending' },
    });
    return row ? { ...row, status: String(row.status) } : null;
  } catch (err) {
    if (!isSchemaMismatchError(err)) throw err;

    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: bigint | number;
        from_user_id: bigint | number;
        to_user_id: bigint | number;
        status: string;
        created_at: Date | null;
        updated_at: Date | null;
      }>
    >(
      `SELECT ${GALLERY_REQUEST_COLUMNS}
       FROM gallery_requests
       WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'
       LIMIT 1`,
      Number(fromUserId),
      Number(toUserId)
    );
    return rows[0] ? mapGalleryRow(rows[0]) : null;
  }
}

export async function sendGalleryRequest(fromUserId: bigint, toUserId: bigint) {
  await assertSocialTarget(fromUserId, toUserId);

  const existing = await findGalleryRequestPair(fromUserId, toUserId);
  if (existing) {
    if (existing.status === 'pending') {
      return { alreadySent: true as const, request: existing };
    }
    if (existing.status === 'accepted') {
      throw AppError.conflict('Gallery access already granted');
    }

    const request = await updateGalleryRequestStatus(existing.id, 'pending');
    return { alreadySent: false as const, request, resent: true as const };
  }

  const request = await insertGalleryRequest(fromUserId, toUserId);
  return { alreadySent: false as const, request };
}

export async function acceptGalleryRequest(ownerUserId: bigint, fromUserId: bigint) {
  const request = await findPendingGalleryRequest(fromUserId, ownerUserId);
  if (!request) throw AppError.notFound('Gallery request not found');
  return updateGalleryRequestStatus(request.id, 'accepted');
}

export async function rejectGalleryRequest(ownerUserId: bigint, fromUserId: bigint) {
  const request = await findPendingGalleryRequest(fromUserId, ownerUserId);
  if (!request) throw AppError.notFound('Gallery request not found');
  return updateGalleryRequestStatus(request.id, 'rejected');
}

export async function hasAcceptedGalleryAccess(fromUserId: bigint, toUserId: bigint): Promise<boolean> {
  try {
    const access = await prisma.galleryRequest.findFirst({
      where: { from_user_id: fromUserId, to_user_id: toUserId, status: 'accepted' },
      select: { id: true },
    });
    return Boolean(access);
  } catch (err) {
    if (!isSchemaMismatchError(err)) throw err;

    const rows = await prisma.$queryRawUnsafe<Array<{ id: bigint | number }>>(
      `SELECT id FROM gallery_requests
       WHERE from_user_id = ? AND to_user_id = ? AND status = 'accepted'
       LIMIT 1`,
      Number(fromUserId),
      Number(toUserId)
    );
    return rows.length > 0;
  }
}
