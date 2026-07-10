import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { PUBLIC_USER_SELECT } from '../utils/helpers';
import { AppError } from '../utils/errors';
import { assertSocialTarget } from './social.service';

export type MessageRequestRow = {
  id: bigint;
  from_user_id: bigint;
  to_user_id: bigint;
  message: string | null;
  status: string;
  created_at: Date | null;
  updated_at: Date | null;
};

export type MessageRequestWithUser = MessageRequestRow & {
  toUser?: Record<string, unknown> | null;
  fromUser?: Record<string, unknown> | null;
};

const COLUMNS = 'id, from_user_id, to_user_id, message, status, created_at, updated_at';

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

function isMissingTableError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2021') return true;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes('message_requests') && (msg.includes("doesn't exist") || msg.includes('does not exist'));
  }
  return false;
}

function tableSetupError(): AppError {
  return AppError.internal(
    'Message requests table is missing. Run deploy/sql/message-requests-setup.sql on the database.'
  );
}

function mapRow(row: {
  id: bigint | number;
  from_user_id: bigint | number;
  to_user_id: bigint | number;
  message?: string | null;
  status: string;
  created_at: Date | null;
  updated_at?: Date | null;
}): MessageRequestRow {
  return {
    id: BigInt(row.id),
    from_user_id: BigInt(row.from_user_id),
    to_user_id: BigInt(row.to_user_id),
    message: row.message ?? null,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at ?? null,
  };
}

async function fetchPublicUsers(userIds: bigint[]): Promise<Map<string, Record<string, unknown>>> {
  if (!userIds.length) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: PUBLIC_USER_SELECT,
  });
  return new Map(users.map((user) => [user.id.toString(), user as Record<string, unknown>]));
}

async function attachUsers(
  rows: MessageRequestRow[],
  userField: 'toUser' | 'fromUser',
  userIdField: 'to_user_id' | 'from_user_id'
): Promise<MessageRequestWithUser[]> {
  const userIds = [...new Set(rows.map((row) => row[userIdField]))];
  const usersById = await fetchPublicUsers(userIds);
  return rows.map((row) => ({
    ...row,
    [userField]: usersById.get(row[userIdField].toString()) ?? null,
  }));
}

async function queryRowsRaw(
  sql: string,
  params: (string | number)[]
): Promise<MessageRequestRow[]> {
  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: bigint | number;
        from_user_id: bigint | number;
        to_user_id: bigint | number;
        message: string | null;
        status: string;
        created_at: Date | null;
        updated_at: Date | null;
      }>
    >(sql, ...params);
    return rows.map(mapRow);
  } catch (err) {
    if (isMissingTableError(err)) throw tableSetupError();
    throw err;
  }
}

async function fetchByDirection(direction: 'sent' | 'received', userId: bigint): Promise<MessageRequestRow[]> {
  const column = direction === 'sent' ? 'from_user_id' : 'to_user_id';
  try {
    const rows = await prisma.messageRequest.findMany({
      where: { [column]: userId },
      orderBy: { created_at: 'desc' },
    });
    return rows.map((row) => ({ ...row, status: String(row.status) }));
  } catch (err) {
    if (!isSchemaMismatchError(err)) throw err;
    return queryRowsRaw(
      `SELECT ${COLUMNS} FROM message_requests WHERE ${column} = ? ORDER BY created_at DESC`,
      [Number(userId)]
    );
  }
}

async function fetchByStatus(
  userId: bigint,
  status: 'accepted' | 'rejected'
): Promise<MessageRequestRow[]> {
  try {
    const rows = await prisma.messageRequest.findMany({
      where: {
        status,
        OR: [{ from_user_id: userId }, { to_user_id: userId }],
      },
      orderBy: { updated_at: 'desc' },
    });
    return rows.map((row) => ({ ...row, status: String(row.status) }));
  } catch (err) {
    if (!isSchemaMismatchError(err)) throw err;
    return queryRowsRaw(
      `SELECT ${COLUMNS}
       FROM message_requests
       WHERE status = ? AND (from_user_id = ? OR to_user_id = ?)
       ORDER BY updated_at DESC, created_at DESC`,
      [status, Number(userId), Number(userId)]
    );
  }
}

function attachBothUsers(rows: MessageRequestRow[]): Promise<MessageRequestWithUser[]> {
  const userIds = [...new Set(rows.flatMap((row) => [row.from_user_id, row.to_user_id]))];
  return fetchPublicUsers(userIds).then((usersById) =>
    rows.map((row) => ({
      ...row,
      fromUser: usersById.get(row.from_user_id.toString()) ?? null,
      toUser: usersById.get(row.to_user_id.toString()) ?? null,
    }))
  );
}

export async function listMessageRequestsSent(userId: bigint) {
  return attachUsers(await fetchByDirection('sent', userId), 'toUser', 'to_user_id');
}

export async function listMessageRequestsReceived(userId: bigint) {
  return attachUsers(await fetchByDirection('received', userId), 'fromUser', 'from_user_id');
}

export async function listMessageRequestsAccepted(userId: bigint) {
  return attachBothUsers(await fetchByStatus(userId, 'accepted'));
}

export async function listMessageRequestsRejected(userId: bigint) {
  return attachBothUsers(await fetchByStatus(userId, 'rejected'));
}

async function findPair(fromUserId: bigint, toUserId: bigint): Promise<MessageRequestRow | null> {
  try {
    const row = await prisma.messageRequest.findUnique({
      where: { from_user_id_to_user_id: { from_user_id: fromUserId, to_user_id: toUserId } },
    });
    return row ? { ...row, status: String(row.status) } : null;
  } catch (err) {
    if (!isSchemaMismatchError(err)) throw err;
    const rows = await queryRowsRaw(
      `SELECT ${COLUMNS} FROM message_requests WHERE from_user_id = ? AND to_user_id = ? LIMIT 1`,
      [Number(fromUserId), Number(toUserId)]
    );
    return rows[0] ?? null;
  }
}

async function findPending(fromUserId: bigint, toUserId: bigint): Promise<MessageRequestRow | null> {
  try {
    const row = await prisma.messageRequest.findFirst({
      where: { from_user_id: fromUserId, to_user_id: toUserId, status: 'pending' },
    });
    return row ? { ...row, status: String(row.status) } : null;
  } catch (err) {
    if (!isSchemaMismatchError(err)) throw err;
    const rows = await queryRowsRaw(
      `SELECT ${COLUMNS}
       FROM message_requests
       WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'
       LIMIT 1`,
      [Number(fromUserId), Number(toUserId)]
    );
    return rows[0] ?? null;
  }
}

async function insertRequest(fromUserId: bigint, toUserId: bigint, note?: string): Promise<MessageRequestRow> {
  try {
    const row = await prisma.messageRequest.create({
      data: {
        from_user_id: fromUserId,
        to_user_id: toUserId,
        status: 'pending',
        message: note?.trim() || null,
      },
    });
    return { ...row, status: String(row.status) };
  } catch (err) {
    if (!isSchemaMismatchError(err)) throw err;
    if (isMissingTableError(err)) throw tableSetupError();

    await prisma.$executeRawUnsafe(
      `INSERT INTO message_requests (from_user_id, to_user_id, message, status, created_at)
       VALUES (?, ?, ?, 'pending', NOW())`,
      Number(fromUserId),
      Number(toUserId),
      note?.trim() || null
    );
    const created = await findPair(fromUserId, toUserId);
    if (!created) throw AppError.internal('Failed to create message request');
    return created;
  }
}

async function updateStatus(id: bigint, status: 'pending' | 'accepted' | 'rejected'): Promise<MessageRequestRow> {
  try {
    const row = await prisma.messageRequest.update({
      where: { id },
      data: { status, updated_at: new Date() },
    });
    return { ...row, status: String(row.status) };
  } catch (err) {
    if (!isSchemaMismatchError(err)) throw err;
    await prisma.$executeRawUnsafe(
      `UPDATE message_requests SET status = ?, updated_at = NOW() WHERE id = ?`,
      status,
      Number(id)
    );
    const rows = await queryRowsRaw(`SELECT ${COLUMNS} FROM message_requests WHERE id = ? LIMIT 1`, [Number(id)]);
    if (!rows[0]) throw AppError.notFound('Message request not found');
    return rows[0];
  }
}

export async function sendMessageRequest(fromUserId: bigint, toUserId: bigint, note?: string) {
  await assertSocialTarget(fromUserId, toUserId);

  const existing = await findPair(fromUserId, toUserId);
  if (existing) {
    if (existing.status === 'pending') {
      return { alreadySent: true as const, request: existing };
    }
    if (existing.status === 'accepted') {
      throw AppError.conflict('Message request already accepted — you can chat now');
    }
    const request = await updateStatus(existing.id, 'pending');
    if (note?.trim()) {
      try {
        await prisma.messageRequest.update({
          where: { id: existing.id },
          data: { message: note.trim() },
        });
        request.message = note.trim();
      } catch {
        /* optional note update */
      }
    }
    return { alreadySent: false as const, request, resent: true as const };
  }

  const request = await insertRequest(fromUserId, toUserId, note);
  return { alreadySent: false as const, request };
}

export async function acceptMessageRequest(ownerUserId: bigint, fromUserId: bigint) {
  const request = await findPending(fromUserId, ownerUserId);
  if (!request) throw AppError.notFound('Message request not found');
  return updateStatus(request.id, 'accepted');
}

export async function rejectMessageRequest(ownerUserId: bigint, fromUserId: bigint) {
  const request = await findPending(fromUserId, ownerUserId);
  if (!request) throw AppError.notFound('Message request not found');
  return updateStatus(request.id, 'rejected');
}

/** Chat allowed when an accepted message request exists in either direction. */
export async function hasAcceptedMessageAccess(userA: bigint, userB: bigint): Promise<boolean> {
  try {
    const access = await prisma.messageRequest.findFirst({
      where: {
        status: 'accepted',
        OR: [
          { from_user_id: userA, to_user_id: userB },
          { from_user_id: userB, to_user_id: userA },
        ],
      },
      select: { id: true },
    });
    return Boolean(access);
  } catch (err) {
    if (!isSchemaMismatchError(err)) throw err;
    const rows = await queryRowsRaw(
      `SELECT id FROM message_requests
       WHERE status = 'accepted'
         AND ((from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?))
       LIMIT 1`,
      [Number(userA), Number(userB), Number(userB), Number(userA)]
    );
    return rows.length > 0;
  }
}

export async function getAcceptedChatPartnerIds(userId: bigint): Promise<bigint[]> {
  try {
    const rows = await prisma.messageRequest.findMany({
      where: { status: 'accepted', OR: [{ from_user_id: userId }, { to_user_id: userId }] },
      select: { from_user_id: true, to_user_id: true },
    });
    return [
      ...new Set(
        rows.map((row) => (row.from_user_id === userId ? row.to_user_id : row.from_user_id).toString())
      ),
    ].map((id) => BigInt(id));
  } catch (err) {
    if (!isSchemaMismatchError(err)) throw err;
    const rows = await queryRowsRaw(
      `SELECT from_user_id, to_user_id FROM message_requests
       WHERE status = 'accepted' AND (from_user_id = ? OR to_user_id = ?)`,
      [Number(userId), Number(userId)]
    );
    return [
      ...new Set(
        rows.map((row) => (row.from_user_id === userId ? row.to_user_id : row.from_user_id).toString())
      ),
    ].map((id) => BigInt(id));
  }
}
