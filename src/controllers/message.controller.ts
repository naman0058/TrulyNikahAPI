import { body } from 'express-validator';
import { AuthRequest, asyncHandler, fullUserGuard, validate, validateBody } from '../middleware';
import prisma from '../lib/prisma';
import { sendSuccess, serialize, enrichAndSerialize } from '../utils/response';
import { routeParam } from '../utils/helpers';
import { AppError } from '../utils/errors';
import { MESSAGE_SEND_FIELDS, V } from '../utils/validation';
import {
  assertCanExchangeMessages,
  listConversationThreads,
  listUnreadMessageThreads,
} from '../services/message.service';
import { emitToUser, getPresenceForUsers } from '../socket/presence';

export const getConversations = [
  ...fullUserGuard,
  asyncHandler(async (req: AuthRequest, res) => {
    const threads = await listConversationThreads(req.userId!);
    return sendSuccess(res, 'Conversations fetched', await enrichAndSerialize(threads));
  }),
];

export const getUnreadMessages = [
  ...fullUserGuard,
  asyncHandler(async (req: AuthRequest, res) => {
    const threads = await listUnreadMessageThreads(req.userId!);
    return sendSuccess(res, 'Unread messages fetched', await enrichAndSerialize(threads));
  }),
];

export const getPresence = [
  ...fullUserGuard,
  asyncHandler(async (req: AuthRequest, res) => {
    const raw = String(req.query.user_ids ?? req.query.userIds ?? '').trim();
    if (!raw) throw AppError.badRequest('user_ids query parameter is required', { user_ids: ['Provide comma-separated user IDs'] });

    const userIds = raw
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    const presence = [...(await getPresenceForUsers(userIds)).values()];
    return sendSuccess(res, 'Presence fetched', presence);
  }),
];

export const getMessages = [
  ...fullUserGuard,
  validate([V.positiveIntParam('userId', 'userId')]),
  asyncHandler(async (req: AuthRequest, res) => {
    const otherId = BigInt(routeParam(req.params.userId));
    await assertCanExchangeMessages(req.userId!, otherId);

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
  ...fullUserGuard,
  validateBody([...MESSAGE_SEND_FIELDS], [
    V.positiveIntBody('receiver_id'),
    body('message')
      .trim()
      .notEmpty()
      .withMessage('message is required')
      .isLength({ max: 5000 })
      .withMessage('message must be at most 5000 characters'),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const receiverId = BigInt(req.body.receiver_id);
    await assertCanExchangeMessages(req.userId!, receiverId);

    const message = await prisma.message.create({
      data: {
        sender_id: req.userId!,
        receiver_id: receiverId,
        message: req.body.message,
      },
    });

    emitToUser(receiverId.toString(), 'message:new', serialize(message));

    return sendSuccess(res, 'Message sent', serialize(message), 201);
  }),
];

export const markRead = [
  ...fullUserGuard,
  validate([V.positiveIntParam('userId', 'userId')]),
  asyncHandler(async (req: AuthRequest, res) => {
    const senderId = BigInt(routeParam(req.params.userId));
    const result = await prisma.message.updateMany({
      where: { sender_id: senderId, receiver_id: req.userId!, read_at: null },
      data: { read_at: new Date() },
    });

    emitToUser(senderId.toString(), 'message:read', {
      reader_id: req.userId!.toString(),
      marked_count: result.count,
    });

    return sendSuccess(res, 'Messages marked as read', { marked_count: result.count });
  }),
];
