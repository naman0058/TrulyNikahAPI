import prisma from '../lib/prisma';
import { AppError } from '../utils/errors';

export async function assertSocialTarget(authUserId: bigint, targetUserId: bigint) {
  if (targetUserId === authUserId) {
    throw AppError.badRequest('Cannot perform this action on yourself');
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, status: true },
  });

  if (!target || target.status === 'deleted' || target.status === 'block') {
    throw AppError.notFound('User not found');
  }

  return target;
}

export async function blockUser(authUserId: bigint, targetUserId: bigint) {
  await assertSocialTarget(authUserId, targetUserId);

  const existing = await prisma.ignore.findFirst({
    where: { user_id: authUserId, ignored_user_id: targetUserId },
  });
  if (existing) {
    return { alreadyBlocked: true as const, record: existing };
  }

  const record = await prisma.ignore.create({
    data: { user_id: authUserId, ignored_user_id: targetUserId },
  });
  return { alreadyBlocked: false as const, record };
}

export async function unblockUser(authUserId: bigint, targetUserId: bigint) {
  const existing = await prisma.ignore.findFirst({
    where: { user_id: authUserId, ignored_user_id: targetUserId },
  });
  if (!existing) {
    throw AppError.notFound('User is not blocked');
  }

  await prisma.ignore.delete({ where: { id: existing.id } });
}

export async function removeFromShortlist(authUserId: bigint, targetUserId: bigint) {
  const existing = await prisma.shortlist.findFirst({
    where: { user_id: authUserId, shortlisted_user_id: targetUserId },
  });
  if (!existing) {
    throw AppError.notFound('Profile not in shortlist');
  }

  await prisma.shortlist.delete({ where: { id: existing.id } });
}
