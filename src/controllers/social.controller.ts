import { AuthRequest, asyncHandler, fullUserGuard, validate, validateBody } from '../middleware';
import prisma from '../lib/prisma';
import { sendSuccess, serialize, enrichAndSerialize } from '../utils/response';
import { PUBLIC_USER_SELECT, routeParam } from '../utils/helpers';
import { AppError } from '../utils/errors';
import { V } from '../utils/validation';
import {
  acceptGalleryRequest,
  blockUser,
  rejectGalleryRequest,
  removeFromShortlist,
  sendGalleryRequest,
  unblockUser,
} from '../services/social.service';
import { PROFILE_IMAGE_FIELDS, toPublicMediaUrl } from '../middleware/upload';

async function targetUserIdFromParams(req: AuthRequest): Promise<bigint> {
  return BigInt(routeParam(req.params.userId));
}

export const sendInterest = [
  ...fullUserGuard,
  validate([V.positiveIntParam('userId', 'userId')]),
  asyncHandler(async (req: AuthRequest, res) => {
    const toUserId = BigInt(routeParam(req.params.userId));
    if (toUserId === req.userId) throw AppError.badRequest('Cannot send interest to yourself');

    const exists = await prisma.interestReceived.findFirst({
      where: { from_user_id: req.userId!, to_user_id: toUserId },
    });
    if (exists) return sendSuccess(res, 'Interest already sent', { alreadySent: true });

    await prisma.interestReceived.create({
      data: { from_user_id: req.userId!, to_user_id: toUserId },
    });
    return sendSuccess(res, 'Interest sent successfully');
  }),
];

export const acceptInterest = [
  ...fullUserGuard,
  validate([V.positiveIntParam('userId', 'userId')]),
  asyncHandler(async (req: AuthRequest, res) => {
    const fromUserId = BigInt(routeParam(req.params.userId));
    const interest = await prisma.interestReceived.findFirst({
      where: { from_user_id: fromUserId, to_user_id: req.userId! },
    });
    if (!interest) throw AppError.notFound('No interest found from this user');

    await prisma.interestReceived.update({
      where: { id: interest.id },
      data: { acceptance: true },
    });
    return sendSuccess(res, 'Interest accepted');
  }),
];

export const removeInterest = [
  ...fullUserGuard,
  validate([V.positiveIntParam('interestId', 'interestId')]),
  asyncHandler(async (req: AuthRequest, res) => {
    await prisma.interestReceived.delete({ where: { id: BigInt(routeParam(req.params.interestId)) } });
    return sendSuccess(res, 'Interest removed');
  }),
];

export const interestsReceived = [
  ...fullUserGuard,
  asyncHandler(async (req: AuthRequest, res) => {
    const list = await prisma.interestReceived.findMany({
      where: { to_user_id: req.userId! },
      include: { fromUser: { select: PUBLIC_USER_SELECT } },
      orderBy: { created_at: 'desc' },
    });
    return sendSuccess(res, 'Interests received', await enrichAndSerialize(list));
  }),
];

export const interestsSent = [
  ...fullUserGuard,
  asyncHandler(async (req: AuthRequest, res) => {
    const list = await prisma.interestReceived.findMany({
      where: { from_user_id: req.userId! },
      include: { toUser: { select: PUBLIC_USER_SELECT } },
      orderBy: { created_at: 'desc' },
    });
    return sendSuccess(res, 'Interests sent', await enrichAndSerialize(list));
  }),
];

export const addShortlist = [
  ...fullUserGuard,
  validateBody(['shortlisted_user_id'], [V.positiveIntBody('shortlisted_user_id')]),
  asyncHandler(async (req: AuthRequest, res) => {
    const targetId = BigInt(req.body.shortlisted_user_id);
    const exists = await prisma.shortlist.findFirst({
      where: { user_id: req.userId!, shortlisted_user_id: targetId },
    });
    if (exists) return sendSuccess(res, 'Already shortlisted', { duplicate: true });

    await prisma.shortlist.create({ data: { user_id: req.userId!, shortlisted_user_id: targetId } });
    return sendSuccess(res, 'Profile shortlisted');
  }),
];

export const getShortlist = [
  ...fullUserGuard,
  asyncHandler(async (req: AuthRequest, res) => {
    const list = await prisma.shortlist.findMany({
      where: { user_id: req.userId! },
      include: { shortlistedUser: { select: PUBLIC_USER_SELECT } },
    });
    return sendSuccess(res, 'Shortlist fetched', await enrichAndSerialize(list));
  }),
];

export const removeShortlist = [
  ...fullUserGuard,
  validate([V.positiveIntParam('userId', 'userId')]),
  asyncHandler(async (req: AuthRequest, res) => {
    await removeFromShortlist(req.userId!, await targetUserIdFromParams(req));
    return sendSuccess(res, 'Removed from shortlist');
  }),
];

export const addIgnore = [
  ...fullUserGuard,
  validateBody(['ignored_user_id'], [V.positiveIntBody('ignored_user_id')]),
  asyncHandler(async (req: AuthRequest, res) => {
    const targetId = BigInt(req.body.ignored_user_id);
    const exists = await prisma.ignore.findFirst({
      where: { user_id: req.userId!, ignored_user_id: targetId },
    });
    if (exists) return sendSuccess(res, 'Already ignored', { duplicate: true });

    await prisma.ignore.create({ data: { user_id: req.userId!, ignored_user_id: targetId } });
    return sendSuccess(res, 'Profile ignored');
  }),
];

export const getIgnored = [
  ...fullUserGuard,
  asyncHandler(async (req: AuthRequest, res) => {
    const list = await prisma.ignore.findMany({
      where: { user_id: req.userId! },
      include: { ignoredUser: { select: PUBLIC_USER_SELECT } },
    });
    return sendSuccess(res, 'Ignored profiles fetched', await enrichAndSerialize(list));
  }),
];

/** Block another user (stored in ignores table — same as Laravel ignore) */
export const blockUserHandler = [
  ...fullUserGuard,
  validate([V.positiveIntParam('userId', 'userId')]),
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await blockUser(req.userId!, await targetUserIdFromParams(req));
    if (result.alreadyBlocked) {
      return sendSuccess(res, 'User already blocked', { alreadyBlocked: true });
    }
    return sendSuccess(res, 'User blocked successfully', serialize(result.record), 201);
  }),
];

export const unblockUserHandler = [
  ...fullUserGuard,
  validate([V.positiveIntParam('userId', 'userId')]),
  asyncHandler(async (req: AuthRequest, res) => {
    await unblockUser(req.userId!, await targetUserIdFromParams(req));
    return sendSuccess(res, 'User unblocked successfully');
  }),
];

export const getBlockedUsers = [
  ...fullUserGuard,
  asyncHandler(async (req: AuthRequest, res) => {
    const list = await prisma.ignore.findMany({
      where: { user_id: req.userId! },
      include: { ignoredUser: { select: PUBLIC_USER_SELECT } },
      orderBy: { created_at: 'desc' },
    });
    return sendSuccess(res, 'Blocked users fetched', await enrichAndSerialize(list));
  }),
];

export const removeIgnore = [
  ...fullUserGuard,
  validate([V.positiveIntParam('userId', 'userId')]),
  asyncHandler(async (req: AuthRequest, res) => {
    await unblockUser(req.userId!, await targetUserIdFromParams(req));
    return sendSuccess(res, 'User unblocked successfully');
  }),
];

export const sendGalleryRequestHandler = [
  ...fullUserGuard,
  validate([V.positiveIntParam('userId', 'userId')]),
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await sendGalleryRequest(req.userId!, await targetUserIdFromParams(req));
    if (result.alreadySent) {
      return sendSuccess(res, 'Gallery request already pending', { alreadySent: true, request: serialize(result.request) });
    }
    const message = 'resent' in result && result.resent ? 'Gallery request sent again' : 'Gallery request sent';
    return sendSuccess(res, message, serialize(result.request), 201);
  }),
];

export const galleryRequestsSent = [
  ...fullUserGuard,
  asyncHandler(async (req: AuthRequest, res) => {
    const list = await prisma.galleryRequest.findMany({
      where: { from_user_id: req.userId! },
      include: { toUser: { select: PUBLIC_USER_SELECT } },
      orderBy: { created_at: 'desc' },
    });
    return sendSuccess(res, 'Gallery requests sent', await enrichAndSerialize(list));
  }),
];

export const galleryRequestsReceived = [
  ...fullUserGuard,
  asyncHandler(async (req: AuthRequest, res) => {
    const list = await prisma.galleryRequest.findMany({
      where: { to_user_id: req.userId! },
      include: { fromUser: { select: PUBLIC_USER_SELECT } },
      orderBy: { created_at: 'desc' },
    });
    return sendSuccess(res, 'Gallery requests received', await enrichAndSerialize(list));
  }),
];

export const acceptGalleryRequestHandler = [
  ...fullUserGuard,
  validate([V.positiveIntParam('userId', 'userId')]),
  asyncHandler(async (req: AuthRequest, res) => {
    const request = await acceptGalleryRequest(req.userId!, await targetUserIdFromParams(req));
    return sendSuccess(res, 'Gallery request accepted', serialize(request));
  }),
];

export const rejectGalleryRequestHandler = [
  ...fullUserGuard,
  validate([V.positiveIntParam('userId', 'userId')]),
  asyncHandler(async (req: AuthRequest, res) => {
    const request = await rejectGalleryRequest(req.userId!, await targetUserIdFromParams(req));
    return sendSuccess(res, 'Gallery request rejected', serialize(request));
  }),
];

/** View another user's gallery after they accepted your request */
export const viewUserGallery = [
  ...fullUserGuard,
  validate([V.positiveIntParam('userId', 'userId')]),
  asyncHandler(async (req: AuthRequest, res) => {
    const targetId = await targetUserIdFromParams(req);
    const authUserId = req.userId!;

    if (targetId === authUserId) {
      throw AppError.badRequest('Use GET /me/gallery for your own gallery');
    }

    const access = await prisma.galleryRequest.findFirst({
      where: { from_user_id: authUserId, to_user_id: targetId, status: 'accepted' },
    });
    if (!access) {
      throw AppError.forbidden('Gallery access not granted. Send a request and wait for acceptance.');
    }

    const manager = await prisma.profileManager.findUnique({ where: { user_id: targetId } });
    if (!manager) {
      return sendSuccess(res, 'Gallery fetched', { photos: {} });
    }

    const photos = Object.fromEntries(
      PROFILE_IMAGE_FIELDS.map((f) => [f, toPublicMediaUrl(manager[f as keyof typeof manager] as string)])
    );
    return sendSuccess(res, 'Gallery fetched', serialize({ userId: targetId, photos }));
  }),
];

export const reportProfile = [
  ...fullUserGuard,
  validateBody(['report_user_id'], [V.positiveIntBody('report_user_id')]),
  asyncHandler(async (req: AuthRequest, res) => {
    const targetId = BigInt(req.body.report_user_id);
    const exists = await prisma.reportMember.findFirst({
      where: { user_id: req.userId!, report_user_id: targetId },
    });
    if (exists) return sendSuccess(res, 'Already reported', { duplicate: true });

    await prisma.reportMember.create({ data: { user_id: req.userId!, report_user_id: targetId } });
    return sendSuccess(res, 'Profile reported');
  }),
];

export const profileViewsByMe = [
  ...fullUserGuard,
  asyncHandler(async (req: AuthRequest, res) => {
    const views = await prisma.profileView.findMany({
      where: { viewer_id: req.userId! },
      include: { viewedUser: { select: PUBLIC_USER_SELECT } },
      orderBy: { created_at: 'desc' },
    });
    return sendSuccess(res, 'Profiles viewed by me', await enrichAndSerialize(views));
  }),
];

export const profileViewsOfMe = [
  ...fullUserGuard,
  asyncHandler(async (req: AuthRequest, res) => {
    const views = await prisma.profileView.findMany({
      where: { viewed_user_id: req.userId! },
      include: { viewer: { select: PUBLIC_USER_SELECT } },
      orderBy: { created_at: 'desc' },
    });
    return sendSuccess(res, 'Who viewed my profile', await enrichAndSerialize(views));
  }),
];
