import { body, query } from 'express-validator';
import { adminAsyncHandler, authenticateAdmin } from '../middleware/adminAuth';
import { validate, validateBody, validateQuery } from '../middleware';
import prisma from '../lib/prisma';
import { sendSuccess, serialize } from '../utils/response';
import { routeParam } from '../utils/helpers';
import { AppError } from '../utils/errors';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function uniquePlanSlug(name: string, excludeId?: bigint): Promise<string> {
  let slug = slugify(name);
  let counter = 1;
  while (true) {
    const existing = await prisma.plan.findFirst({
      where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    });
    if (!existing) return slug;
    slug = `${slugify(name)}-${counter++}`;
  }
}

export const listPlans = [
  authenticateAdmin,
  validateQuery(['validity_type'], [
    query('validity_type').optional().isIn(['monthly', 'unlimited', 'assisted']).withMessage('Invalid validity_type'),
  ]),
  adminAsyncHandler(async (req, res) => {
    const validityType = req.query.validity_type ? String(req.query.validity_type) : undefined;
    const plans = await prisma.plan.findMany({
      where: {
        user_id: null,
        ...(validityType ? { validity_type: validityType as never } : {}),
      },
      include: { variants: true },
      orderBy: { created_at: 'desc' },
    });
    return sendSuccess(res, 'Plans fetched', serialize(plans));
  }),
];

export const getPlan = [
  authenticateAdmin,
  adminAsyncHandler(async (req, res) => {
    const plan = await prisma.plan.findFirst({
      where: { slug: routeParam(req.params.slug) },
      include: { variants: true },
    });
    if (!plan) throw AppError.notFound('Plan not found');
    return sendSuccess(res, 'Plan fetched', serialize(plan));
  }),
];

export const createPlan = [
  authenticateAdmin,
  validateBody(
    [
      'name',
      'description',
      'unlimited_messages',
      'premium_tag',
      'unlimited_photo_request',
      'unlimited_profile_view',
      'customer_support',
      'profile_boost_up',
      'validity_type',
      'feature_one',
      'feature_two',
      'feature_three',
      'feature_four',
      'feature_five',
      'feature_six',
      'feature_seven',
      'feature_eight',
      'status',
      'variants',
    ],
    [body('name').notEmpty().withMessage('name is required'), body('validity_type').isIn(['monthly', 'unlimited', 'assisted']).withMessage('Invalid validity_type')]
  ),
  adminAsyncHandler(async (req, res) => {
    const slug = await uniquePlanSlug(req.body.name);
    const plan = await prisma.plan.create({
      data: {
        name: req.body.name,
        slug,
        description: req.body.description,
        unlimited_messages: Boolean(req.body.unlimited_messages),
        premium_tag: Boolean(req.body.premium_tag),
        unlimited_photo_request: Boolean(req.body.unlimited_photo_request),
        unlimited_profile_view: Boolean(req.body.unlimited_profile_view),
        customer_support: Boolean(req.body.customer_support),
        profile_boost_up: Boolean(req.body.profile_boost_up),
        validity_type: req.body.validity_type,
        feature_one: req.body.feature_one,
        feature_two: req.body.feature_two,
        feature_three: req.body.feature_three,
        feature_four: req.body.feature_four,
        feature_five: req.body.feature_five,
        feature_six: req.body.feature_six,
        feature_seven: req.body.feature_seven,
        feature_eight: req.body.feature_eight,
        status: req.body.status !== false,
      },
    });

    if (Array.isArray(req.body.variants)) {
      for (const v of req.body.variants) {
        await prisma.planVariant.create({
          data: {
            plan_id: plan.id,
            price: parseInt(v.price, 10),
            duration_months: parseInt(v.duration_months, 10),
            verify_contacts: parseInt(v.verify_contacts, 10),
            original_price: parseInt(v.original_price ?? v.price, 10),
            discount: parseInt(v.discount ?? 0, 10),
            save_money: parseInt(v.save_money ?? 0, 10),
          },
        });
      }
    }

    const full = await prisma.plan.findUnique({ where: { id: plan.id }, include: { variants: true } });
    return sendSuccess(res, 'Plan created', serialize(full), 201);
  }),
];

export const updatePlan = [
  authenticateAdmin,
  validateBody(
    [
      'id',
      'name',
      'description',
      'unlimited_messages',
      'premium_tag',
      'unlimited_photo_request',
      'unlimited_profile_view',
      'customer_support',
      'profile_boost_up',
      'validity_type',
      'status',
      'variants',
    ],
    [body('id').isInt({ min: 1 }).withMessage('id must be a positive integer'), body('name').optional().notEmpty().withMessage('name cannot be empty')]
  ),
  adminAsyncHandler(async (req, res) => {
    const planId = BigInt(req.body.id);
    const existing = await prisma.plan.findUnique({ where: { id: planId } });
    if (!existing) throw AppError.notFound('Plan not found');

    const slug = req.body.name ? await uniquePlanSlug(req.body.name, planId) : existing.slug;

    await prisma.plan.update({
      where: { id: planId },
      data: {
        name: req.body.name ?? existing.name,
        slug,
        description: req.body.description,
        unlimited_messages: req.body.unlimited_messages ?? existing.unlimited_messages,
        premium_tag: req.body.premium_tag ?? existing.premium_tag,
        unlimited_photo_request: req.body.unlimited_photo_request ?? existing.unlimited_photo_request,
        unlimited_profile_view: req.body.unlimited_profile_view ?? existing.unlimited_profile_view,
        customer_support: req.body.customer_support ?? existing.customer_support,
        profile_boost_up: req.body.profile_boost_up ?? existing.profile_boost_up,
        validity_type: req.body.validity_type ?? existing.validity_type,
        status: req.body.status ?? existing.status,
      },
    });

    if (Array.isArray(req.body.variants)) {
      for (const v of req.body.variants) {
        if (v.id) {
          await prisma.planVariant.update({
            where: { id: BigInt(v.id) },
            data: {
              price: parseInt(v.price, 10),
              duration_months: parseInt(v.duration_months, 10),
              verify_contacts: parseInt(v.verify_contacts, 10),
              original_price: parseInt(v.original_price, 10),
              discount: parseInt(v.discount, 10),
              save_money: parseInt(v.save_money, 10),
            },
          });
        } else {
          await prisma.planVariant.create({
            data: {
              plan_id: planId,
              price: parseInt(v.price, 10),
              duration_months: parseInt(v.duration_months, 10),
              verify_contacts: parseInt(v.verify_contacts, 10),
              original_price: parseInt(v.original_price ?? v.price, 10),
              discount: parseInt(v.discount ?? 0, 10),
              save_money: parseInt(v.save_money ?? 0, 10),
            },
          });
        }
      }
    }

    const full = await prisma.plan.findUnique({ where: { id: planId }, include: { variants: true } });
    return sendSuccess(res, 'Plan updated', serialize(full));
  }),
];

export const deletePlan = [
  authenticateAdmin,
  adminAsyncHandler(async (req, res) => {
    const planId = BigInt(routeParam(req.params.planId));
    await prisma.plan.delete({ where: { id: planId } });
    return sendSuccess(res, 'Plan deleted');
  }),
];

export const togglePlanStatus = [
  authenticateAdmin,
  validateBody(['id', 'status'], [
    body('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
    body('status').isBoolean().withMessage('status must be boolean'),
  ]),
  adminAsyncHandler(async (req, res) => {
    const plan = await prisma.plan.update({
      where: { id: BigInt(req.body.id) },
      data: { status: req.body.status },
    });
    return sendSuccess(res, 'Plan status updated', serialize(plan));
  }),
];

export const assignSubscription = [
  authenticateAdmin,
  validateBody(['user_id', 'plan_id', 'plan_variant_id'], [
    body('user_id').isInt({ min: 1 }).withMessage('user_id must be a positive integer'),
    body('plan_id').isInt({ min: 1 }).withMessage('plan_id must be a positive integer'),
    body('plan_variant_id').isInt({ min: 1 }).withMessage('plan_variant_id must be a positive integer'),
  ]),
  adminAsyncHandler(async (req, res) => {
    const variant = await prisma.planVariant.findUnique({
      where: { id: BigInt(req.body.plan_variant_id) },
    });
    if (!variant) throw AppError.notFound('Plan variant not found');

    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    endsAt.setMonth(endsAt.getMonth() + variant.duration_months);

    const { generateUniqueInvoiceNumber } = await import('../utils/helpers');

    const sub = await prisma.subscription.create({
      data: {
        user_id: BigInt(req.body.user_id),
        plan_id: BigInt(req.body.plan_id),
        plan_variants: variant.id,
        amount: String(variant.price),
        starts_at: startsAt,
        ends_at: endsAt,
        verified_contacts: String(variant.verify_contacts),
        transaction_id: 'admin',
        payment_status: 'paid',
        invoice_number: generateUniqueInvoiceNumber(),
        status: true,
      },
    });

    await prisma.user.update({
      where: { id: BigInt(req.body.user_id) },
      data: { status: 'premium' },
    });

    return sendSuccess(res, 'Subscription assigned', serialize(sub), 201);
  }),
];

export const cancelSubscription = [
  authenticateAdmin,
  adminAsyncHandler(async (req, res) => {
    const subId = BigInt(routeParam(req.params.subscriptionId));
    const sub = await prisma.subscription.update({
      where: { id: subId },
      data: { status: false },
    });
    await prisma.user.update({ where: { id: sub.user_id }, data: { status: 'free' } });
    return sendSuccess(res, 'Subscription cancelled', serialize(sub));
  }),
];
