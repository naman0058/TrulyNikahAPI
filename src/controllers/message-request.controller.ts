import { body } from 'express-validator';
import { AuthRequest, asyncHandler, fullUserGuard, validate, validateBody } from '../middleware';
import { sendSuccess, serialize, enrichAndSerialize } from '../utils/response';
import { routeParam } from '../utils/helpers';
import { V } from '../utils/validation';
import {
  acceptMessageRequest,
  listMessageRequestsAccepted,
  listMessageRequestsReceived,
  listMessageRequestsRejected,
  listMessageRequestsSent,
  rejectMessageRequest,
  sendMessageRequest,
} from '../services/message-request.service';

async function targetUserIdFromParams(req: AuthRequest): Promise<bigint> {
  return BigInt(routeParam(req.params.userId));
}

export const sendMessageRequestHandler = [
  ...fullUserGuard,
  validate([V.positiveIntParam('userId', 'userId')]),
  validateBody(['message'], [
    body('message').optional().isString().trim().isLength({ max: 500 }).withMessage('message must be at most 500 characters'),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await sendMessageRequest(req.userId!, await targetUserIdFromParams(req), req.body.message);
    if (result.alreadySent) {
      return sendSuccess(res, 'Message request already pending', {
        alreadySent: true,
        request: serialize(result.request),
      });
    }
    const msg = 'resent' in result && result.resent ? 'Message request sent again' : 'Message request sent';
    return sendSuccess(res, msg, serialize(result.request), 201);
  }),
];

export const messageRequestsSent = [
  ...fullUserGuard,
  asyncHandler(async (req: AuthRequest, res) => {
    const list = await listMessageRequestsSent(req.userId!);
    return sendSuccess(res, 'Message requests sent', await enrichAndSerialize(list));
  }),
];

export const messageRequestsReceived = [
  ...fullUserGuard,
  asyncHandler(async (req: AuthRequest, res) => {
    const list = await listMessageRequestsReceived(req.userId!);
    return sendSuccess(res, 'Message requests received', await enrichAndSerialize(list));
  }),
];

export const messageRequestsAccepted = [
  ...fullUserGuard,
  asyncHandler(async (req: AuthRequest, res) => {
    const list = await listMessageRequestsAccepted(req.userId!);
    return sendSuccess(res, 'Accepted message requests', await enrichAndSerialize(list));
  }),
];

export const messageRequestsRejected = [
  ...fullUserGuard,
  asyncHandler(async (req: AuthRequest, res) => {
    const list = await listMessageRequestsRejected(req.userId!);
    return sendSuccess(res, 'Rejected message requests', await enrichAndSerialize(list));
  }),
];

export const acceptMessageRequestHandler = [
  ...fullUserGuard,
  validate([V.positiveIntParam('userId', 'userId')]),
  asyncHandler(async (req: AuthRequest, res) => {
    const request = await acceptMessageRequest(req.userId!, await targetUserIdFromParams(req));
    return sendSuccess(res, 'Message request accepted', serialize(request));
  }),
];

export const rejectMessageRequestHandler = [
  ...fullUserGuard,
  validate([V.positiveIntParam('userId', 'userId')]),
  asyncHandler(async (req: AuthRequest, res) => {
    const request = await rejectMessageRequest(req.userId!, await targetUserIdFromParams(req));
    return sendSuccess(res, 'Message request rejected', serialize(request));
  }),
];
