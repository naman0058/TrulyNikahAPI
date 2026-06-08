import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';

export type AdminNotificationRow = {
  id: bigint;
  sender_id: bigint | null;
  receiver_id: bigint | null;
  message: string;
  read_at: Date | null;
  created_at: Date | null;
};

function isSchemaMismatchError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return ['P2021', 'P2022', 'P2010'].includes(err.code);
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes("doesn't exist") || msg.includes('unknown column');
  }
  return false;
}

async function findNotificationsRaw(receiverId: bigint): Promise<AdminNotificationRow[]> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: bigint | number;
      sender_id: bigint | number | null;
      receiver_id: bigint | number | null;
      message: string;
      read_at: Date | null;
      created_at: Date | null;
    }>
  >(
    `SELECT id, sender_id, receiver_id, message, read_at, created_at
     FROM admin_messages
     WHERE receiver_id = ?
     ORDER BY created_at DESC`,
    Number(receiverId)
  );

  return rows.map((row) => ({
    id: BigInt(row.id),
    sender_id: row.sender_id != null ? BigInt(row.sender_id) : null,
    receiver_id: row.receiver_id != null ? BigInt(row.receiver_id) : null,
    message: row.message,
    read_at: row.read_at,
    created_at: row.created_at,
  }));
}

/** Admin notifications for a user — raw SQL fallback if Prisma schema drifts from DB. */
export async function findNotificationsForUser(receiverId: bigint): Promise<AdminNotificationRow[]> {
  try {
    return await prisma.adminMessage.findMany({
      where: { receiver_id: receiverId },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        sender_id: true,
        receiver_id: true,
        message: true,
        read_at: true,
        created_at: true,
      },
    });
  } catch (err) {
    if (!isSchemaMismatchError(err)) throw err;
    try {
      return await findNotificationsRaw(receiverId);
    } catch {
      return [];
    }
  }
}
