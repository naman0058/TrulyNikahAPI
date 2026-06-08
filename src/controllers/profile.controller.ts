import { AuthRequest, asyncHandler, authenticate, fullUserGuard, validate, validateBody } from '../middleware';
import { body, param } from 'express-validator';
import prisma from '../lib/prisma';
import { sendSuccess, serialize, enrichAndSerialize } from '../utils/response';
import { AppError, ErrorCode } from '../utils/errors';
import { PUBLIC_USER_SELECT, heightStringToInches, routeParam, getProfileCompletion } from '../utils/helpers';
import { enrichUserForClient, enrichSafeUser } from '../services/user-display.service';
import { upsertPartnerPreference } from '../services/partner-preference.service';
import { findNotificationsForUser } from '../services/notification.service';
import { allowedValues, validationMessage } from '../constants/fieldOptions';
import {
  ALLOWED_FAMILY_FIELDS,
  ALLOWED_PARTNER_FIELDS,
  ALLOWED_RELIGIOUS_FIELDS,
  pickBody,
  TRUST_BADGE_FIELDS,
  V,
} from '../utils/validation';

export const updateBasic = [
  ...fullUserGuard,
  validateBody(['name', 'gender'], [V.nonEmptyString('name'), V.enumField('gender')]),
  asyncHandler(async (req: AuthRequest, res) => {
    const user = await prisma.user.update({
      where: { id: req.userId! },
      data: { name: req.body.name, gender: req.body.gender },
    });
    return sendSuccess(res, 'Basic details updated', serialize(await enrichUserForClient(user as never)));
  }),
];

export const updatePersonal = [
  ...fullUserGuard,
  validateBody(
    ['height', 'cast', 'mother_tounge', 'any_disability'],
    [
      V.nonEmptyString('height'),
      V.nonEmptyString('cast'),
      V.nonEmptyString('mother_tounge'),
      V.nonEmptyString('any_disability'),
    ]
  ),
  asyncHandler(async (req: AuthRequest, res) => {
    const inches = heightStringToInches(req.body.height);
    if (inches === null) throw AppError.badRequest('Invalid height format', { height: ['Use format like 5ft 4in'] });
    const user = await prisma.user.update({
      where: { id: req.userId! },
      data: {
        height: inches.toString(),
        cast: req.body.cast,
        mother_tounge: req.body.mother_tounge,
        any_disability: req.body.any_disability,
      },
    });
    return sendSuccess(res, 'Personal details updated', serialize(await enrichUserForClient(user as never)));
  }),
];

export const updateAbout = [
  ...fullUserGuard,
  validateBody(['about_us'], [V.nonEmptyString('about_us')]),
  asyncHandler(async (req: AuthRequest, res) => {
    const user = await prisma.user.update({
      where: { id: req.userId! },
      data: { about_us: req.body.about_us },
    });
    return sendSuccess(res, 'About updated', serialize(await enrichUserForClient(user as never)));
  }),
];

export const updateEducation = [
  ...fullUserGuard,
  validateBody(
    ['highest_education', 'college', 'occupation', 'employed_in', 'annual_income', 'occupation_details'],
    [
      V.nonEmptyString('highest_education'),
      V.nonEmptyString('college'),
      V.nonEmptyString('occupation'),
      V.nonEmptyString('employed_in'),
      V.nonEmptyString('annual_income'),
      V.nonEmptyString('occupation_details'),
    ]
  ),
  asyncHandler(async (req: AuthRequest, res) => {
    const user = await prisma.user.update({
      where: { id: req.userId! },
      data: {
        highest_education: req.body.highest_education,
        college: req.body.college,
        occupation: req.body.occupation,
        employed_in: req.body.employed_in,
        annual_income: req.body.annual_income,
        occupation_details: req.body.occupation_details,
      },
    });
    return sendSuccess(res, 'Education updated', serialize(await enrichUserForClient(user as never)));
  }),
];

export const updateContactLocation = [
  ...fullUserGuard,
  validateBody(['country', 'state', 'city'], [
    V.nonEmptyString('country'),
    V.nonEmptyString('state'),
    V.nonEmptyString('city'),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const user = await prisma.user.update({
      where: { id: req.userId! },
      data: {
        country: req.body.country,
        state: req.body.state,
        city: req.body.city,
      },
    });
    return sendSuccess(res, 'Contact location updated', serialize(await enrichUserForClient(user as never)));
  }),
];

export const updatePrivacy = [
  ...fullUserGuard,
  validateBody(['profile_visibility'], [
    body('profile_visibility')
      .isIn(allowedValues('profile_visibility'))
      .withMessage(validationMessage('profile_visibility')),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const user = await prisma.user.update({
      where: { id: req.userId! },
      data: { profile_visibility: req.body.profile_visibility },
    });
    return sendSuccess(res, 'Privacy updated', serialize(await enrichUserForClient(user as never)));
  }),
];

export const updatePartnerPreferences = [
  ...fullUserGuard,
  validateBody(
    [...ALLOWED_PARTNER_FIELDS],
    [
      ...ALLOWED_PARTNER_FIELDS.map((field) => {
        if (field === 'age_from' || field === 'age_to') {
          return body(field)
            .optional({ values: 'null' })
            .custom((val) => {
              if (val == null || val === '') return true;
              const n = Number(val);
              return Number.isInteger(n) && n >= 18 && n <= 100;
            })
            .withMessage(`${field} must be an integer between 18 and 100`);
        }
        return body(field).optional({ values: 'null' }).isString().trim();
      }),
      body('age_to')
        .optional({ values: 'null' })
        .custom((val, { req }) => {
          if (val == null || val === '' || req.body.age_from == null || req.body.age_from === '') return true;
          return Number(val) >= Number(req.body.age_from);
        })
        .withMessage('age_to must be greater than or equal to age_from'),
    ]
  ),
  asyncHandler(async (req: AuthRequest, res) => {
    const bodyData = pickBody(req.body, [...ALLOWED_PARTNER_FIELDS]) as Record<string, unknown>;
    const pref = await upsertPartnerPreference(req.userId!, bodyData);
    return sendSuccess(res, 'Partner preferences saved', await enrichAndSerialize(pref));
  }),
];

export const updateFamily = [
  ...fullUserGuard,
  validateBody([...ALLOWED_FAMILY_FIELDS], ALLOWED_FAMILY_FIELDS.map((f) => body(f).optional())),
  asyncHandler(async (req: AuthRequest, res) => {
    const existing = await prisma.familyInformation.findFirst({ where: { user_id: req.userId! } });
    const data = { user_id: req.userId!, ...pickBody(req.body, [...ALLOWED_FAMILY_FIELDS]) };
    const family = existing
      ? await prisma.familyInformation.update({ where: { id: existing.id }, data })
      : await prisma.familyInformation.create({ data });
    return sendSuccess(res, 'Family info saved', serialize(family));
  }),
];

export const updateReligious = [
  ...fullUserGuard,
  validateBody([...ALLOWED_RELIGIOUS_FIELDS], ALLOWED_RELIGIOUS_FIELDS.map((f) => body(f).optional())),
  asyncHandler(async (req: AuthRequest, res) => {
    const existing = await prisma.religiousAndLifeStype.findFirst({ where: { user_id: req.userId! } });
    const data = { user_id: req.userId!, ...pickBody(req.body, [...ALLOWED_RELIGIOUS_FIELDS]) };
    const religious = existing
      ? await prisma.religiousAndLifeStype.update({ where: { id: existing.id }, data })
      : await prisma.religiousAndLifeStype.create({ data });
    return sendSuccess(res, 'Religious info saved', serialize(religious));
  }),
];

export const revealContact = [
  ...fullUserGuard,
  validate([V.positiveIntParam('userId', 'userId')]),
  asyncHandler(async (req: AuthRequest, res) => {
    const authUser = req.user!;
    const targetId = BigInt(routeParam(req.params.userId));

    if (authUser.status !== 'premium') throw AppError.premiumRequired();

    const subscription = await prisma.subscription.findFirst({
      where: { user_id: authUser.id, status: true },
      orderBy: { created_at: 'desc' },
    });
    if (!subscription) throw AppError.premiumRequired('No active subscription');

    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw AppError.notFound('User not found');

    const alreadyViewed = await prisma.contactView.findFirst({
      where: { viewer_id: authUser.id, viewed_user_id: targetId },
    });

    const quota = parseInt(subscription.verified_contacts ?? '0', 10);

    if (alreadyViewed) {
      return sendSuccess(res, 'Contact retrieved', {
        contactNumber: target.contact_number,
        email: target.email,
        remainingQuota: quota,
      });
    }

    if (quota < 1) throw AppError.forbidden('Contact reveal quota exhausted', ErrorCode.PREMIUM_REQUIRED);

    await prisma.$transaction([
      prisma.contactView.create({ data: { viewer_id: authUser.id, viewed_user_id: targetId } }),
      prisma.subscription.update({
        where: { id: subscription.id },
        data: { verified_contacts: (quota - 1).toString() },
      }),
    ]);

    return sendSuccess(res, 'Contact revealed', {
      contactNumber: target.contact_number,
      email: target.email,
      remainingQuota: quota - 1,
    });
  }),
];

export const mySubscription = [
  ...fullUserGuard,
  asyncHandler(async (req: AuthRequest, res) => {
    const subs = await prisma.subscription.findMany({
      where: { user_id: req.userId! },
      include: { plan: true, variant: true },
      orderBy: { created_at: 'desc' },
    });
    return sendSuccess(res, 'Subscriptions fetched', serialize(subs));
  }),
];

export const notifications = [
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const messages = await findNotificationsForUser(req.userId!);
    return sendSuccess(res, 'Notifications fetched', serialize(messages));
  }),
];

export const requestCallback = [
  ...fullUserGuard,
  validateBody(['phone', 'alt_phone'], [
    body('phone').optional().matches(/^\d{10}$/).withMessage('phone must be 10 digits'),
    body('alt_phone').optional().matches(/^\d{10}$/).withMessage('alt_phone must be 10 digits'),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const record = await prisma.requestACall.create({
      data: {
        user_id: req.userId!,
        phone: req.body.phone ?? req.user!.contact_number,
        alt_phone: req.body.alt_phone,
      },
    });
    return sendSuccess(res, 'Callback request submitted', serialize(record), 201);
  }),
];

export const submitTrustBadge = [
  ...fullUserGuard,
  validateBody([...TRUST_BADGE_FIELDS], [
    V.nonEmptyString('verification_type'),
    V.optionalString('image'),
    V.optionalString('image2'),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const badge = await prisma.trustBadge.upsert({
      where: { user_id: req.userId! },
      create: {
        user_id: req.userId!,
        verification_type: req.body.verification_type,
        image: req.body.image,
        image2: req.body.image2,
        status: 'Pending',
      },
      update: {
        verification_type: req.body.verification_type,
        image: req.body.image,
        image2: req.body.image2,
        status: 'Pending',
      },
    });
    return sendSuccess(res, 'Trust badge submitted for review', serialize(badge));
  }),
];

export const getMyTrustBadge = [
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const badge = await prisma.trustBadge.findUnique({ where: { user_id: req.userId! } });
    return sendSuccess(res, 'Trust badge fetched', serialize(badge));
  }),
];

export const getMyProfile = [
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      include: {
        profileManager: true,
        trustBadge: true,
        partnerPreferences: true,
        familyInformation: true,
        religiousInfo: true,
        subscriptions: { include: { plan: true, variant: true }, orderBy: { created_at: 'desc' }, take: 5 },
      },
    });
    if (!user) throw AppError.notFound('User not found');

    const { password: _, remember_token: __, ...safe } = user;
    return sendSuccess(res, 'Profile fetched', {
      user: serialize(await enrichSafeUser(safe)),
      completion: getProfileCompletion(safe as never),
    });
  }),
];

export const getProfileCompletionStatus = [
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    return sendSuccess(res, 'Profile completion', getProfileCompletion(req.user! as never));
  }),
];

export const contactViewsByMe = [
  ...fullUserGuard,
  asyncHandler(async (req: AuthRequest, res) => {
    const views = await prisma.contactView.findMany({
      where: { viewer_id: req.userId! },
      include: { viewedUser: { select: PUBLIC_USER_SELECT } },
      orderBy: { created_at: 'desc' },
    });
    return sendSuccess(res, 'Contact views fetched', await enrichAndSerialize(views));
  }),
];

export const contactViewsOfMe = [
  ...fullUserGuard,
  asyncHandler(async (req: AuthRequest, res) => {
    const views = await prisma.contactView.findMany({
      where: { viewed_user_id: req.userId! },
      include: { viewer: { select: PUBLIC_USER_SELECT } },
      orderBy: { created_at: 'desc' },
    });
    return sendSuccess(res, 'Who viewed my contact', await enrichAndSerialize(views));
  }),
];
