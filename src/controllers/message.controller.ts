import { body } from 'express-validator';
import { AuthRequest, asyncHandler, authenticate, requireProfileComplete, validate, validateBody } from '../middleware';
import prisma from '../lib/prisma';
import { sendSuccess, serialize } from '../utils/response';
import { PUBLIC_USER_SELECT, routeParam } from '../utils/helpers';
import { AppError } from '../utils/errors';
import { MESSAGE_SEND_FIELDS, V } from '../utils/validation';

const messageGuard = [authenticate, requireProfileComplete];

async function hasMutualInterest(userA: bigint, userB: bigint): Promise<boolean> {
  const [aToB, bToA] = await Promise.all([
    prisma.interestReceived.findFirst({
      where: { from_user_id: userA, to_user_id: userB, acceptance: true },
    }),
    prisma.interestReceived.findFirst({
      where: { from_user_id: userB, to_user_id: userA, acceptance: true },
    }),
  ]);
  return Boolean(aToB || bToA);
}

export const getConversations = [
  ...messageGuard,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.userId!;

    const sentAccepted = await prisma.interestReceived.findMany({
      where: { from_user_id: userId, acceptance: true },
      include: { toUser: { select: PUBLIC_USER_SELECT } },
    });

    const receivedAccepted = await prisma.interestReceived.findMany({
      where: { to_user_id: userId, acceptance: true },
      include: { fromUser: { select: PUBLIC_USER_SELECT } },
    });

    return sendSuccess(res, 'Conversations fetched', serialize({ sentAccepted, receivedAccepted }));
  }),
];

export const getMessages = [
  ...messageGuard,
  validate([V.positiveIntParam('userId', 'userId')]),
  asyncHandler(async (req: AuthRequest, res) => {
    const otherId = BigInt(routeParam(req.params.userId));
    const allowed = await hasMutualInterest(req.userId!, otherId);
    if (!allowed) throw AppError.forbidden('Messaging allowed only after mutual interest acceptance');

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { sender_id: req.userId!, receiver_id: otherId },
          { sender_id: otherId, receiver_id: req.userId! },
        ],
      },
      orderBy: { created_at: 'asc' },
    });

    return sendSuccess(res, 'Messages fetched', serialize(messages));
  }),
];

export const sendMessage = [
  ...messageGuard,
  validateBody([...MESSAGE_SEND_FIELDS], [
    V.positiveIntBody('receiver_id'),
    body('message').trim().notEmpty().withMessage('message is required').isLength({ max: 5000 }).withMessage('message must be at most 5000 characters'),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const receiverId = BigInt(req.body.receiver_id);
    const allowed = await hasMutualInterest(req.userId!, receiverId);
    if (!allowed) throw AppError.forbidden('Messaging allowed only after mutual interest acceptance');

    const message = await prisma.message.create({
      data: {
        sender_id: req.userId!,
        receiver_id: receiverId,
        message: req.body.message,
      },
    });

    return sendSuccess(res, 'Message sent', serialize(message), 201);
  }),
];

export const markRead = [
  ...messageGuard,
  validate([V.positiveIntParam('userId', 'userId')]),
  asyncHandler(async (req: AuthRequest, res) => {
    const senderId = BigInt(routeParam(req.params.userId));
    await prisma.message.updateMany({
      where: { sender_id: senderId, receiver_id: req.userId!, read_at: null },
      data: { read_at: new Date() },
    });
    return sendSuccess(res, 'Messages marked as read');
  }),
];
