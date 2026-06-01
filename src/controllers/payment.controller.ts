import crypto from 'crypto';
import Razorpay from 'razorpay';
import { body, param } from 'express-validator';
import { AuthRequest, asyncHandler, fullUserGuard, validate, validateBody } from '../middleware';
import config from '../config';
import prisma from '../lib/prisma';
import { sendSuccess, serialize } from '../utils/response';
import { generateUniqueInvoiceNumber, routeParam } from '../utils/helpers';
import { AppError } from '../utils/errors';
import { PAYMENT_CREATE_FIELDS, PAYMENT_VERIFY_FIELDS, V } from '../utils/validation';

function getRazorpay() {
  if (!config.razorpay.key || !config.razorpay.secret) {
    throw AppError.internal('Razorpay is not configured');
  }
  return new Razorpay({ key_id: config.razorpay.key, key_secret: config.razorpay.secret });
}

export const createOrder = [
  ...fullUserGuard,
  validateBody([...PAYMENT_CREATE_FIELDS], [
    body('amount')
      .notEmpty()
      .withMessage('amount is required')
      .bail()
      .isNumeric()
      .withMessage('amount must be numeric')
      .custom((v) => parseFloat(v) >= 1)
      .withMessage('amount must be at least 1'),
    V.optionalPositiveIntBody('plan_id'),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const amountInPaise = Math.round(parseFloat(req.body.amount) * 100);
    const razorpay = getRazorpay();

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: crypto.randomUUID(),
    });

    return sendSuccess(res, 'Order created', {
      order_id: order.id,
      amount: order.amount,
      plan_id: req.body.plan_id,
      key: config.razorpay.key,
    });
  }),
];

export const verifyPayment = [
  ...fullUserGuard,
  validateBody([...PAYMENT_VERIFY_FIELDS], [
    V.nonEmptyString('razorpay_order_id'),
    V.nonEmptyString('razorpay_payment_id'),
    V.nonEmptyString('razorpay_signature'),
    V.positiveIntBody('plan_id'),
    V.positiveIntBody('vid'),
    body('plan_duration').optional().isInt({ min: 1, max: 36 }).withMessage('plan_duration must be 1-36'),
    body('verified_contact').optional().isInt({ min: 0 }).withMessage('verified_contact must be a non-negative integer'),
    body('amount').optional().isNumeric().withMessage('amount must be numeric'),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan_id, vid, plan_duration, verified_contact, amount } =
      req.body;

    const expected = crypto
      .createHmac('sha256', config.razorpay.secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expected !== razorpay_signature) throw AppError.paymentError('Invalid payment signature');

    const months = parseInt(String(plan_duration), 10) || 1;
    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    endsAt.setMonth(endsAt.getMonth() + months);

    const subscription = await prisma.subscription.create({
      data: {
        user_id: req.userId!,
        plan_id: BigInt(plan_id),
        plan_variants: BigInt(vid),
        amount: String(amount),
        starts_at: startsAt,
        ends_at: endsAt,
        verified_contacts: String(verified_contact),
        transaction_id: razorpay_payment_id,
        payment_status: 'success',
        invoice_number: generateUniqueInvoiceNumber(),
        status: true,
      },
    });

    await prisma.user.update({ where: { id: req.userId! }, data: { status: 'premium' } });

    return sendSuccess(res, 'Payment verified and subscription activated', serialize(subscription));
  }),
];

export const paymentHistory = [
  ...fullUserGuard,
  asyncHandler(async (req: AuthRequest, res) => {
    const subs = await prisma.subscription.findMany({
      where: { user_id: req.userId! },
      include: { plan: true, variant: true },
      orderBy: { created_at: 'desc' },
    });
    return sendSuccess(res, 'Payment history fetched', serialize(subs));
  }),
];

export const getInvoice = [
  ...fullUserGuard,
  validate([param('invoiceNumber').trim().notEmpty().withMessage('invoiceNumber is required')]),
  asyncHandler(async (req: AuthRequest, res) => {
    const invoiceNumber = routeParam(req.params.invoiceNumber);
    const subscription = await prisma.subscription.findFirst({
      where: { invoice_number: invoiceNumber, user_id: req.userId! },
      include: { plan: true, variant: true, user: { select: { name: true, email: true, member_id: true, contact_number: true } } },
    });
    if (!subscription) throw AppError.notFound('Invoice not found');
    return sendSuccess(res, 'Invoice fetched', serialize(subscription));
  }),
];

export const getActiveSubscription = [
  ...fullUserGuard,
  asyncHandler(async (req: AuthRequest, res) => {
    const subscription = await prisma.subscription.findFirst({
      where: { user_id: req.userId!, status: true, ends_at: { gte: new Date() } },
      include: { plan: true, variant: true },
      orderBy: { created_at: 'desc' },
    });
    if (!subscription) throw AppError.notFound('No active subscription');
    return sendSuccess(res, 'Active subscription fetched', serialize(subscription));
  }),
];
