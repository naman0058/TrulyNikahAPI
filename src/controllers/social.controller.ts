import { AuthRequest, asyncHandler, fullUserGuard, validate, validateBody } from '../middleware';
import prisma from '../lib/prisma';
import { sendSuccess, serialize, enrichAndSerialize } from '../utils/response';
import { PUBLIC_USER_SELECT, routeParam } from '../utils/helpers';
import { AppError } from '../utils/errors';
import { V } from '../utils/validation';

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
