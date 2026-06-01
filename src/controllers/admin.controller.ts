import { body, query } from 'express-validator';
import { adminAsyncHandler, authenticateAdmin, AdminRequest } from '../middleware/adminAuth';
import { validate, validateQuery, validateBody } from '../middleware';
import { V } from '../utils/validation';
import { getDashboardStats, loginAdmin } from '../services/admin.service';
import { sendSuccess, serialize, paginationMeta } from '../utils/response';
import prisma from '../lib/prisma';
import { routeParam } from '../utils/helpers';
import { AppError } from '../utils/errors';

export const adminLogin = [
  validateBody(['email', 'password'], [V.email(), V.nonEmptyString('password', 'password')]),
  adminAsyncHandler(async (req, res) => {
    const result = await loginAdmin(req.body.email, req.body.password);
    return sendSuccess(res, 'Admin login successful', {
      token: result.token,
      admin: serialize(result.admin),
    });
  }),
];

export const adminDashboard = [
  authenticateAdmin,
  adminAsyncHandler(async (_req, res) => {
    const stats = await getDashboardStats();
    return sendSuccess(res, 'Dashboard stats', serialize(stats));
  }),
];

export const adminSales = [
  authenticateAdmin,
  adminAsyncHandler(async (_req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const now = new Date();

    const subscriptions = await prisma.subscription.findMany({
      select: { amount: true, created_at: true, ends_at: true, status: true, transaction_id: true },
    });

    const sumAmount = (rows: typeof subscriptions) =>
      rows.reduce((acc, row) => acc + (parseFloat(row.amount ?? '0') || 0), 0);

    const paidSubs = subscriptions.filter((s) => s.transaction_id !== 'admin');
    const totalSales = sumAmount(paidSubs);
    const todaySales = sumAmount(paidSubs.filter((s) => s.created_at >= today));
    const yesterdaySales = sumAmount(
      paidSubs.filter((s) => s.created_at >= yesterday && s.created_at < today)
    );
    const activePlans = paidSubs.filter(
      (s) => s.status && s.ends_at && s.ends_at > now
    ).length;
    const activePlansByAdmin = subscriptions.filter(
      (s) => s.transaction_id === 'admin' && s.status && s.ends_at && s.ends_at > now
    ).length;
    const expiredPlans = paidSubs.filter((s) => s.ends_at && s.ends_at <= now).length;

    const dailyMap = new Map<string, number>();
    for (const row of paidSubs) {
      const date = row.created_at.toISOString().slice(0, 10);
      const amt = parseFloat(row.amount ?? '0') || 0;
      dailyMap.set(date, (dailyMap.get(date) ?? 0) + amt);
    }

    const chart = [...dailyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7)
      .map(([date, total]) => ({ date, total: total.toFixed(2) }));

    return sendSuccess(res, 'Sales stats', serialize({
      totalSales: totalSales.toFixed(2),
      todaySales: todaySales.toFixed(2),
      yesterdaySales: yesterdaySales.toFixed(2),
      activePlans,
      activePlansByAdmin,
      expiredPlans,
      chart,
    }));
  }),
];

export const listMembers = [
  authenticateAdmin,
  validateQuery(
    ['page', 'limit', 'status', 'keyword'],
    [
      ...V.pagination(),
      query('status').optional().isIn(['pending', 'verified', 'premium', 'free', 'deleted', 'block']).withMessage('Invalid status filter'),
      query('keyword').optional().isString().trim(),
    ]
  ),
  adminAsyncHandler(async (req: AdminRequest, res) => {
    const { status, keyword, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (status) where.status = String(status);
    if (keyword) {
      where.OR = [
        { name: { contains: String(keyword) } },
        { email: { contains: String(keyword) } },
        { member_id: { contains: String(keyword) } },
        { contact_number: { contains: String(keyword) } },
      ];
    }

    const [members, total] = await Promise.all([
      prisma.user.findMany({
        where: where as never,
        skip,
        take: limitNum,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          member_id: true,
          name: true,
          email: true,
          contact_number: true,
          gender: true,
          status: true,
          phone_verified: true,
          created_at: true,
        },
      }),
      prisma.user.count({ where: where as never }),
    ]);

    return sendSuccess(res, 'Members fetched', serialize(members), 200, paginationMeta(pageNum, limitNum, total));
  }),
];

export const getMember = [
  authenticateAdmin,
  validate([V.memberIdParam()]),
  adminAsyncHandler(async (req, res) => {
    const member = await prisma.user.findFirst({
      where: { member_id: routeParam(req.params.memberId) },
      include: {
        trustBadge: true,
        profileManager: true,
        partnerPreferences: true,
        familyInformation: true,
        religiousInfo: true,
        subscriptions: { include: { plan: true, variant: true } },
      },
    });
    if (!member) throw AppError.notFound('Member not found');
    const { password: _, remember_token: __, ...safe } = member;
    return sendSuccess(res, 'Member fetched', serialize(safe));
  }),
];

export const listPendingTrustBadges = [
  authenticateAdmin,
  adminAsyncHandler(async (_req, res) => {
    const badges = await prisma.trustBadge.findMany({
      where: { status: 'Pending' },
      include: { user: { select: { id: true, member_id: true, name: true, email: true } } },
      orderBy: { created_at: 'desc' },
    });
    return sendSuccess(res, 'Pending trust badges', serialize(badges));
  }),
];

export const updateTrustBadge = [
  authenticateAdmin,
  validateBody(['trust_badge_id', 'status'], [
    V.positiveIntBody('trust_badge_id'),
    body('status').isIn(['Pending', 'Verified', 'Rejected']).withMessage('status must be Pending, Verified, or Rejected'),
  ]),
  adminAsyncHandler(async (req, res) => {
    const badgeId = BigInt(req.body.trust_badge_id);
    const badge = await prisma.trustBadge.update({
      where: { id: badgeId },
      data: { status: req.body.status },
    });

    if (req.body.status === 'Verified') {
      await prisma.user.update({ where: { id: badge.user_id }, data: { status: 'verified' } });
    } else if (req.body.status === 'Pending') {
      await prisma.user.update({ where: { id: badge.user_id }, data: { status: 'pending' } });
    }

    return sendSuccess(res, 'Trust badge updated', serialize(badge));
  }),
];

export const listSubscriptions = [
  authenticateAdmin,
  adminAsyncHandler(async (_req, res) => {
    const subs = await prisma.subscription.findMany({
      include: {
        user: { select: { member_id: true, name: true, email: true } },
        plan: true,
        variant: true,
      },
      orderBy: { created_at: 'desc' },
      take: 100,
    });
    return sendSuccess(res, 'Subscriptions fetched', serialize(subs));
  }),
];

export const updateMember = [
  authenticateAdmin,
  validate([V.positiveIntParam('userId', 'userId')]),
  validateBody(['name', 'status', 'phone_verified', 'profile_visibility'], [
    body('name').optional().trim().notEmpty().withMessage('name cannot be empty'),
    body('status').optional().isIn(['pending', 'verified', 'premium', 'free', 'deleted', 'block']).withMessage('Invalid status'),
    body('phone_verified').optional().isBoolean().withMessage('phone_verified must be boolean'),
    body('profile_visibility').optional().isIn(['no-one', 'everyone', 'interested', 'verified', 'premium']).withMessage('Invalid profile_visibility'),
  ]),
  adminAsyncHandler(async (req, res) => {
    const userId = BigInt(routeParam(req.params.userId));
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) throw AppError.notFound('Member not found');

    const allowedFields = ['name', 'status', 'phone_verified', 'profile_visibility'] as const;
    const data: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    }

    const updated = await prisma.user.update({ where: { id: userId }, data: data as never });
    const { password: _, remember_token: __, ...safe } = updated;
    return sendSuccess(res, 'Member updated', serialize(safe));
  }),
];

export const adminLogout = [
  authenticateAdmin,
  adminAsyncHandler(async (_req, res) => {
    return sendSuccess(res, 'Admin logged out successfully');
  }),
];

export const softDeleteMember = [
  authenticateAdmin,
  validate([V.positiveIntParam('userId', 'userId')]),
  adminAsyncHandler(async (req, res) => {
    const user = await prisma.user.update({
      where: { id: BigInt(routeParam(req.params.userId)) },
      data: { status: 'deleted' },
    });
    return sendSuccess(res, 'Member moved to deleted', serialize({ id: user.id, status: user.status }));
  }),
];

export const restoreMember = [
  authenticateAdmin,
  validate([V.positiveIntParam('userId', 'userId')]),
  adminAsyncHandler(async (req, res) => {
    const user = await prisma.user.update({
      where: { id: BigInt(routeParam(req.params.userId)) },
      data: { status: 'pending' },
    });
    return sendSuccess(res, 'Member restored', serialize({ id: user.id, status: user.status }));
  }),
];

export const listReports = [
  authenticateAdmin,
  adminAsyncHandler(async (_req, res) => {
    const reports = await prisma.reportMember.findMany({
      include: {
        reporter: { select: { member_id: true, name: true } },
        reported: { select: { member_id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    return sendSuccess(res, 'Reported profiles', serialize(reports));
  }),
];

export const listContactEnquiries = [
  authenticateAdmin,
  adminAsyncHandler(async (_req, res) => {
    const enquiries = await prisma.contactEnquiry.findMany({ orderBy: { created_at: 'desc' } });
    return sendSuccess(res, 'Contact enquiries', serialize(enquiries));
  }),
];

export const listCallbackRequests = [
  authenticateAdmin,
  adminAsyncHandler(async (_req, res) => {
    const requests = await prisma.requestACall.findMany({ orderBy: { created_at: 'desc' } });
    return sendSuccess(res, 'Callback requests', serialize(requests));
  }),
];
