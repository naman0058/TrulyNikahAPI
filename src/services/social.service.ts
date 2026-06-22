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

export async function sendGalleryRequest(fromUserId: bigint, toUserId: bigint) {
  await assertSocialTarget(fromUserId, toUserId);

  const existing = await prisma.galleryRequest.findUnique({
    where: { from_user_id_to_user_id: { from_user_id: fromUserId, to_user_id: toUserId } },
  });

  if (existing) {
    if (existing.status === 'pending') {
      return { alreadySent: true as const, request: existing };
    }
    if (existing.status === 'accepted') {
      throw AppError.conflict('Gallery access already granted');
    }

    const request = await prisma.galleryRequest.update({
      where: { id: existing.id },
      data: { status: 'pending', updated_at: new Date() },
    });
    return { alreadySent: false as const, request, resent: true as const };
  }

  const request = await prisma.galleryRequest.create({
    data: { from_user_id: fromUserId, to_user_id: toUserId, status: 'pending' },
  });
  return { alreadySent: false as const, request };
}

export async function acceptGalleryRequest(ownerUserId: bigint, fromUserId: bigint) {
  const request = await prisma.galleryRequest.findFirst({
    where: { from_user_id: fromUserId, to_user_id: ownerUserId, status: 'pending' },
  });
  if (!request) throw AppError.notFound('Gallery request not found');

  return prisma.galleryRequest.update({
    where: { id: request.id },
    data: { status: 'accepted', updated_at: new Date() },
  });
}

export async function rejectGalleryRequest(ownerUserId: bigint, fromUserId: bigint) {
  const request = await prisma.galleryRequest.findFirst({
    where: { from_user_id: fromUserId, to_user_id: ownerUserId, status: 'pending' },
  });
  if (!request) throw AppError.notFound('Gallery request not found');

  return prisma.galleryRequest.update({
    where: { id: request.id },
    data: { status: 'rejected', updated_at: new Date() },
  });
}
