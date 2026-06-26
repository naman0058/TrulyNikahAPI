import { AuthRequest, asyncHandler, fullUserGuard, validate, validateBody, validateQuery } from '../middleware';
import prisma from '../lib/prisma';
import { sendSuccess, serialize, paginationMeta, enrichAndSerialize } from '../utils/response';
import { PUBLIC_USER_SELECT, maskEmail, maskPhone, routeParam, parseBigIntId } from '../utils/helpers';
import { AppError } from '../utils/errors';
import { getBestMatches, getNewProfiles } from '../services/discovery.service';
import {
  countryExists,
  findCitiesByStateId,
  findStatesByCountryId,
  stateExists,
} from '../services/location.service';
import { body, query } from 'express-validator';
import { V, CONTACT_ENQUIRY_FIELDS, SEARCH_BODY_FIELDS, normalizeSearchBody } from '../utils/validation';
import { searchProfiles as runProfileSearch, SearchFiltersInput } from '../services/search.service';
import { getSearchFilterOptions } from '../constants/searchFilters';

export const getCountries = asyncHandler(async (_req, res) => {
  const countries = await prisma.country.findMany({ orderBy: { name: 'asc' } });
  return sendSuccess(res, 'Countries fetched', serialize(countries));
});

export const getStates = [
  validate([V.positiveIntParam('countryId', 'countryId')]),
  asyncHandler(async (req, res) => {
    const countryId = parseBigIntId(req.params.countryId, 'countryId');
    if (!(await countryExists(countryId))) throw AppError.notFound('Country not found');

    const states = await findStatesByCountryId(countryId);
    return sendSuccess(res, 'States fetched', serialize(states));
  }),
];

export const getCities = [
  validate([V.positiveIntParam('stateId', 'stateId')]),
  asyncHandler(async (req, res) => {
    const stateId = parseBigIntId(req.params.stateId, 'stateId');
    if (!(await stateExists(stateId))) throw AppError.notFound('State not found');

    const cities = await findCitiesByStateId(stateId);
    return sendSuccess(res, 'Cities fetched', serialize(cities));
  }),
];

export const getCastes = asyncHandler(async (_req, res) => {
  const castes = await prisma.caste.findMany({ orderBy: { caste: 'asc' } });
  return sendSuccess(res, 'Castes fetched', serialize(castes));
});

export const getCasteById = [
  validate([V.positiveIntParam('casteId', 'casteId')]),
  asyncHandler(async (req, res) => {
    const casteId = parseBigIntId(req.params.casteId, 'casteId');
  const caste = await prisma.caste.findUnique({
    where: { id: casteId },
    include: { subCastes: { orderBy: { subcaste: 'asc' } } },
  });
  if (!caste) throw AppError.notFound('Caste not found');
    return sendSuccess(res, 'Caste fetched', serialize(caste));
  }),
];

export const getSubCastes = [
  validate([V.positiveIntParam('casteId', 'casteId')]),
  asyncHandler(async (req, res) => {
    const casteId = parseBigIntId(req.params.casteId, 'casteId');
  const caste = await prisma.caste.findUnique({ where: { id: casteId } });
  if (!caste) throw AppError.notFound('Caste not found');

  const subCastes = await prisma.subCaste.findMany({
    where: { caste_id: casteId },
    orderBy: { subcaste: 'asc' },
  });
    return sendSuccess(res, 'Sub-castes fetched', serialize(subCastes));
  }),
];

export const getSubCastesLegacy = [
  validate([V.positiveIntParam('casteId', 'casteId')]),
  asyncHandler(async (req, res) => {
    const casteId = parseBigIntId(req.params.casteId, 'casteId');
  const subCastes = await prisma.subCaste.findMany({
    where: { caste_id: casteId },
    orderBy: { subcaste: 'asc' },
  });
    return res.json(serialize(subCastes));
  }),
];

export const getCountriesLegacy = asyncHandler(async (_req, res) => {
  const countries = await prisma.country.findMany({ orderBy: { name: 'asc' } });
  return res.json(serialize(countries));
});

/** Laravel-compatible: GET /state/{country_id} — returns raw JSON array */
export const getStatesLegacy = [
  validate([V.positiveIntParam('countryId', 'countryId')]),
  asyncHandler(async (req, res) => {
    const countryId = parseBigIntId(req.params.countryId, 'countryId');
    const states = await findStatesByCountryId(countryId);
    return res.json(serialize(states));
  }),
];

export const getCitiesLegacy = [
  validate([V.positiveIntParam('stateId', 'stateId')]),
  asyncHandler(async (req, res) => {
    const stateId = parseBigIntId(req.params.stateId, 'stateId');
    const cities = await findCitiesByStateId(stateId);
    return res.json(serialize(cities));
  }),
];

export const getPlans = asyncHandler(async (_req, res) => {
  const plans = await prisma.plan.findMany({
    where: { status: true },
    include: { variants: true },
    orderBy: { created_at: 'desc' },
  });
  return sendSuccess(res, 'Plans fetched', serialize(plans));
});

export const getFaqs = asyncHandler(async (_req, res) => {
  const faqs = await prisma.faq.findMany({ orderBy: { created_at: 'desc' } });
  return sendSuccess(res, 'FAQs fetched', serialize(faqs));
});

export const getBlogs = asyncHandler(async (_req, res) => {
  const blogs = await prisma.blog.findMany({
    select: { id: true, title: true, slug: true, image: true, created_at: true },
    orderBy: { created_at: 'desc' },
  });
  return sendSuccess(res, 'Blogs fetched', serialize(blogs));
});

export const getBlogBySlug = [
  validate([V.slugParam('slug')]),
  asyncHandler(async (req, res) => {
  const blog = await prisma.blog.findFirst({
    where: { slug: routeParam(req.params.slug) },
    include: { category: true },
  });
  if (!blog) throw AppError.notFound('Blog not found');
    return sendSuccess(res, 'Blog fetched', serialize(blog));
  }),
];

export const getStories = asyncHandler(async (_req, res) => {
  const stories = await prisma.story.findMany({ orderBy: { created_at: 'desc' } });
  return sendSuccess(res, 'Stories fetched', serialize(stories));
});

export const getPolicy = [
  validate([V.policyTypeParam()]),
  asyncHandler(async (req, res) => {
  const type = routeParam(req.params.type);
  const policy = await prisma.privacyPolicy.findFirst({ where: { type } });
  if (!policy) throw AppError.notFound('Policy not found');
    return sendSuccess(res, 'Policy fetched', serialize(policy));
  }),
];

export const getCounters = asyncHandler(async (_req, res) => {
  const counters = await prisma.counter.findFirst({ orderBy: { created_at: 'desc' } });
  return sendSuccess(res, 'Counters fetched', serialize(counters ?? {}));
});

export const submitContactEnquiry = [
  validateBody([...CONTACT_ENQUIRY_FIELDS], [
    V.nonEmptyString('name'),
    V.email(),
    V.nonEmptyString('message'),
    body('phone').optional().matches(/^\d{10}$/).withMessage('phone must be 10 digits'),
  ]),
  asyncHandler(async (req, res) => {
    const { name, email, phone, message } = req.body;

    const enquiry = await prisma.contactEnquiry.create({
    data: { name, email, phone, message, status: 'pending' },
  });
    return sendSuccess(res, 'Enquiry submitted', serialize(enquiry), 201);
  }),
];

export const getDashboard = [
  ...fullUserGuard,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = req.user!;
    const oppositeGender = user.gender === 'male' ? 'female' : 'male';

    const [matches, recentProfiles, viewedProfiles, bestMatches, newProfiles] = await Promise.all([
      prisma.user.findMany({
        where: { gender: oppositeGender, status: { in: ['verified', 'premium'] }, id: { not: user.id } },
        select: PUBLIC_USER_SELECT,
        take: 12,
        orderBy: { created_at: 'desc' },
      }),
      prisma.user.findMany({
        where: { gender: oppositeGender, id: { not: user.id } },
        select: PUBLIC_USER_SELECT,
        take: 8,
        orderBy: { created_at: 'desc' },
      }),
      prisma.profileView.findMany({
        where: { viewer_id: user.id },
        include: { viewedUser: { select: PUBLIC_USER_SELECT } },
        take: 10,
        orderBy: { created_at: 'desc' },
      }),
      getBestMatches(user, 12),
      getNewProfiles(user, 8),
    ]);

    return sendSuccess(res, 'Dashboard data', await enrichAndSerialize({ matches, recentProfiles, viewedProfiles, bestMatches, newProfiles }));
  }),
];

export const getBestMatchesHandler = [
  ...fullUserGuard,
  validateQuery(['limit'], [query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be 1-50')]),
  asyncHandler(async (req: AuthRequest, res) => {
    const limit = Math.min(parseInt(String(req.query.limit ?? '12'), 10) || 12, 50);
    const matches = await getBestMatches(req.user!, limit);
    return sendSuccess(res, 'Best matches fetched', await enrichAndSerialize(matches));
  }),
];

export const getNewProfilesHandler = [
  ...fullUserGuard,
  validateQuery(['limit'], [query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be 1-50')]),
  asyncHandler(async (req: AuthRequest, res) => {
    const limit = Math.min(parseInt(String(req.query.limit ?? '12'), 10) || 12, 50);
    const profiles = await getNewProfiles(req.user!, limit);
    return sendSuccess(res, 'New profiles fetched', await enrichAndSerialize(profiles));
  }),
];

export const viewProfile = [
  ...fullUserGuard,
  validate([V.memberIdParam()]),
  asyncHandler(async (req: AuthRequest, res) => {
    const profile = await prisma.user.findFirst({
      where: { member_id: routeParam(req.params.memberId) },
      include: { profileManager: true, trustBadge: true },
    });
    if (!profile) throw AppError.notFound('Profile not found');
    if (profile.status === 'deleted' || profile.status === 'block') {
      throw AppError.notFound('Profile not found');
    }

    await prisma.profileView.create({
      data: { viewer_id: req.userId!, viewed_user_id: profile.id },
    });

    const safe = await enrichAndSerialize({
      ...profile,
      password: undefined,
      remember_token: undefined,
      contact_number: maskPhone(profile.contact_number ?? ''),
      email: maskEmail(profile.email),
    });

    return sendSuccess(res, 'Profile fetched', safe);
  }),
];

export const getSearchFilters = asyncHandler(async (_req, res) => {
  return sendSuccess(res, 'Search filter options for mobile app', getSearchFilterOptions());
});

export const searchProfiles = [
  ...fullUserGuard,
  validateBody([...SEARCH_BODY_FIELDS], [
    body('name').optional().isString().trim().isLength({ min: 1, max: 255 }).withMessage('name must be 1-255 characters'),
    body('age_from').optional().isInt({ min: 18, max: 100 }).withMessage('age_from must be 18-100'),
    body('age_to').optional().isInt({ min: 18, max: 100 }).withMessage('age_to must be 18-100'),
    body('age_range').optional().isString().trim().isLength({ min: 1, max: 20 }),
    body('height_from').optional(),
    body('height_to').optional(),
    body('income_min_lakh').optional().isFloat({ min: 0 }).withMessage('income_min_lakh must be >= 0'),
    body('income_max_lakh').optional().isFloat({ min: 0 }).withMessage('income_max_lakh must be >= 0'),
    body('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
    body('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be 1-50'),
    V.optionalStringOrStringArray('marital_status'),
    V.optionalFilterValue('sect'),
    V.optionalFilterValue('cast'),
    V.optionalFilterValue('country'),
    V.optionalFilterValue('state'),
    V.optionalFilterValue('city'),
    V.optionalStringOrStringArray('highest_education'),
    V.optionalStringOrStringArray('employed_in'),
    V.optionalStringOrStringArray('mother_tounge'),
    V.optionalStringOrStringArray('annual_income'),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const filters = normalizeSearchBody(req.body) as SearchFiltersInput;
    const { results, page, limit, total } = await runProfileSearch(req.user!, filters);
    return sendSuccess(res, 'Search results', await enrichAndSerialize(results), 200, paginationMeta(page, limit, total));
  }),
];
