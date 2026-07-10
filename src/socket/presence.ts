import type { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import config from '../config';
import prisma from '../lib/prisma';
import { verifyUserToken } from '../lib/jwt';

export type PresenceStatus = {
  user_id: string;
  is_online: boolean;
  last_seen_at: string | null;
  last_seen_ago: string | null;
};

const onlineConnections = new Map<string, number>();
let io: Server | null = null;

export function formatLastSeenAgo(date: Date | null | undefined): string | null {
  if (!date) return null;
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'} ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;

  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

function buildPresence(userId: string, isOnline: boolean, lastSeenAt: Date | null): PresenceStatus {
  return {
    user_id: userId,
    is_online: isOnline,
    last_seen_at: lastSeenAt ? lastSeenAt.toISOString() : null,
    last_seen_ago: isOnline ? null : formatLastSeenAgo(lastSeenAt),
  };
}

export function isUserOnline(userId: string): boolean {
  return (onlineConnections.get(userId) ?? 0) > 0;
}

export async function getPresenceForUsers(userIds: string[]): Promise<Map<string, PresenceStatus>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, PresenceStatus>();
  if (!unique.length) return map;

  const offlineIds: bigint[] = [];
  for (const id of unique) {
    if (isUserOnline(id)) {
      map.set(id, buildPresence(id, true, null));
    } else {
      offlineIds.push(BigInt(id));
    }
  }

  if (!offlineIds.length) return map;

  try {
    const users = await prisma.user.findMany({
      where: { id: { in: offlineIds } },
      select: { id: true, last_seen_at: true, last_login_at: true },
    });
    for (const user of users) {
      const id = user.id.toString();
      const lastSeen = user.last_seen_at ?? user.last_login_at ?? null;
      map.set(id, buildPresence(id, false, lastSeen));
    }
  } catch {
    for (const id of offlineIds) {
      map.set(id.toString(), buildPresence(id.toString(), false, null));
    }
  }

  for (const id of unique) {
    if (!map.has(id)) map.set(id, buildPresence(id, false, null));
  }

  return map;
}

export function getSocketServer(): Server | null {
  return io;
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(`user:${userId}`).emit(event, payload);
}

function incrementOnline(userId: string): void {
  onlineConnections.set(userId, (onlineConnections.get(userId) ?? 0) + 1);
}

function decrementOnline(userId: string): number {
  const next = (onlineConnections.get(userId) ?? 1) - 1;
  if (next <= 0) {
    onlineConnections.delete(userId);
    return 0;
  }
  onlineConnections.set(userId, next);
  return next;
}

async function authenticateSocket(socket: Socket): Promise<string> {
  const authHeader = socket.handshake.auth?.token ?? socket.handshake.headers.authorization;
  const token =
    typeof authHeader === 'string'
      ? authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : authHeader
      : null;

  if (!token) throw new Error('Authentication required');

  const payload = verifyUserToken(token);
  return payload.sub;
}

export function initSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigins.length ? config.corsOrigins : true,
      credentials: true,
    },
    path: '/socket.io',
  });

  io.use(async (socket, next) => {
    try {
      socket.data.userId = await authenticateSocket(socket);
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const userId = String(socket.data.userId);
    socket.join(`user:${userId}`);

    incrementOnline(userId);
    io!.emit('presence:online', buildPresence(userId, true, null));

    socket.on('presence:subscribe', async (userIds: unknown) => {
      const ids = Array.isArray(userIds) ? userIds.map(String) : [];
      const statuses = [...(await getPresenceForUsers(ids)).values()];
      socket.emit('presence:status', statuses);
    });

    socket.on('disconnect', async () => {
      const remaining = decrementOnline(userId);
      if (remaining > 0) return;

      const lastSeen = new Date();
      try {
        await prisma.user.update({
          where: { id: BigInt(userId) },
          data: { last_seen_at: lastSeen },
        });
      } catch {
        /* column may not exist until SQL migration */
      }

      io!.emit('presence:offline', buildPresence(userId, false, lastSeen));
    });
  });

  return io;
}
