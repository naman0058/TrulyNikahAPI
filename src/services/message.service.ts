import prisma from '../lib/prisma';
import { PUBLIC_USER_SELECT } from '../utils/helpers';
import { AppError } from '../utils/errors';
import { getAcceptedChatPartnerIds, hasAcceptedMessageAccess } from './message-request.service';
import { getPresenceForUsers } from '../socket/presence';

export async function assertCanExchangeMessages(userA: bigint, userB: bigint): Promise<void> {
  const allowed = await hasAcceptedMessageAccess(userA, userB);
  if (!allowed) {
    throw AppError.forbidden('Messaging allowed only after message request is accepted');
  }
}

export async function listConversationThreads(userId: bigint) {
  const partnerIds = await getAcceptedChatPartnerIds(userId);
  if (!partnerIds.length) return [];

  const partners = await prisma.user.findMany({
    where: { id: { in: partnerIds } },
    select: PUBLIC_USER_SELECT,
  });

  const presenceMap = await getPresenceForUsers(partnerIds.map((id) => id.toString()));

  const threads = await Promise.all(
    partners.map(async (partner) => {
      const partnerId = partner.id;
      const [latest, unreadCount] = await Promise.all([
        prisma.message.findFirst({
          where: {
            OR: [
              { sender_id: userId, receiver_id: partnerId },
              { sender_id: partnerId, receiver_id: userId },
            ],
          },
          orderBy: { created_at: 'desc' },
        }),
        prisma.message.count({
          where: { sender_id: partnerId, receiver_id: userId, read_at: null },
        }),
      ]);

      const presence = presenceMap.get(partnerId.toString());

      return {
        user: partner,
        unread_count: unreadCount,
        latest_message: latest
          ? {
              id: latest.id,
              sender_id: latest.sender_id,
              receiver_id: latest.receiver_id,
              message: latest.message,
              read_at: latest.read_at,
              created_at: latest.created_at,
            }
          : null,
        presence: presence ?? {
          user_id: partnerId.toString(),
          is_online: false,
          last_seen_at: null,
          last_seen_ago: null,
        },
      };
    })
  );

  threads.sort((a, b) => {
    const aTime = a.latest_message?.created_at?.getTime() ?? 0;
    const bTime = b.latest_message?.created_at?.getTime() ?? 0;
    return bTime - aTime;
  });

  return threads;
}

export async function listUnreadMessageThreads(userId: bigint) {
  const unreadGroups = await prisma.message.groupBy({
    by: ['sender_id'],
    where: { receiver_id: userId, read_at: null },
    _count: { id: true },
    _max: { created_at: true },
  });

  if (!unreadGroups.length) return [];

  const senderIds = unreadGroups.map((g) => g.sender_id);
  const senders = await prisma.user.findMany({
    where: { id: { in: senderIds } },
    select: PUBLIC_USER_SELECT,
  });
  const sendersById = new Map(senders.map((u) => [u.id.toString(), u]));
  const presenceMap = await getPresenceForUsers(senderIds.map((id) => id.toString()));

  const threads = await Promise.all(
    unreadGroups.map(async (group) => {
      const senderId = group.sender_id;
      const latest = await prisma.message.findFirst({
        where: { sender_id: senderId, receiver_id: userId, read_at: null },
        orderBy: { created_at: 'desc' },
      });

      return {
        user: sendersById.get(senderId.toString()) ?? null,
        unread_count: group._count.id,
        latest_message: latest,
        presence: presenceMap.get(senderId.toString()) ?? {
          user_id: senderId.toString(),
          is_online: false,
          last_seen_at: null,
          last_seen_ago: null,
        },
      };
    })
  );

  threads.sort(
    (a, b) => (b.latest_message?.created_at?.getTime() ?? 0) - (a.latest_message?.created_at?.getTime() ?? 0)
  );

  return threads;
}
