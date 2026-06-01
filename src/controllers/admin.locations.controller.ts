import { body, param, query } from 'express-validator';
import { adminAsyncHandler, authenticateAdmin } from '../middleware/adminAuth';
import { validate, validateBody, validateQuery } from '../middleware';
import prisma from '../lib/prisma';
import { sendSuccess, serialize } from '../utils/response';
import { routeParam } from '../utils/helpers';
import { AppError } from '../utils/errors';

export const listCountries = [
  authenticateAdmin,
  adminAsyncHandler(async (_req, res) => {
    const countries = await prisma.country.findMany({ orderBy: { name: 'asc' } });
    return sendSuccess(res, 'Countries fetched', serialize(countries));
  }),
];

export const createCountry = [
  authenticateAdmin,
  validateBody(['name'], [body('name').notEmpty().trim().withMessage('name is required')]),
  adminAsyncHandler(async (req, res) => {
    const country = await prisma.country.create({ data: { name: req.body.name } });
    return sendSuccess(res, 'Country created', serialize(country), 201);
  }),
];

export const updateCountry = [
  authenticateAdmin,
  validateBody(['id', 'name'], [
    body('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
    body('name').notEmpty().trim().withMessage('name is required'),
  ]),
  adminAsyncHandler(async (req, res) => {
    const id = BigInt(req.body.id);
    const existing = await prisma.country.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Country not found');

    const country = await prisma.country.update({ where: { id }, data: { name: req.body.name } });
    return sendSuccess(res, 'Country updated', serialize(country));
  }),
];

export const deleteCountry = [
  authenticateAdmin,
  param('id').isNumeric(),
  validate([param('id').isNumeric()]),
  adminAsyncHandler(async (req, res) => {
    const id = BigInt(routeParam(req.params.id));
    const existing = await prisma.country.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Country not found');

    await prisma.country.delete({ where: { id } });
    return sendSuccess(res, 'Country deleted');
  }),
];

export const listStates = [
  authenticateAdmin,
  validateQuery(['country_id'], [query('country_id').optional().isInt({ min: 1 }).withMessage('country_id must be a positive integer')]),
  adminAsyncHandler(async (req, res) => {
    const countryId = req.query.country_id ? BigInt(String(req.query.country_id)) : undefined;
    const states = await prisma.state.findMany({
      where: countryId ? { country_id: countryId } : undefined,
      include: { country: true },
      orderBy: { name: 'asc' },
    });
    return sendSuccess(res, 'States fetched', serialize(states));
  }),
];

export const createState = [
  authenticateAdmin,
  validateBody(['name', 'country_id'], [
    body('name').notEmpty().trim().withMessage('name is required'),
    body('country_id').isInt({ min: 1 }).withMessage('country_id must be a positive integer'),
  ]),
  adminAsyncHandler(async (req, res) => {
    const countryId = BigInt(req.body.country_id);
    const country = await prisma.country.findUnique({ where: { id: countryId } });
    if (!country) throw AppError.notFound('Country not found');

    const state = await prisma.state.create({
      data: { name: req.body.name, country_id: countryId },
    });
    return sendSuccess(res, 'State created', serialize(state), 201);
  }),
];

export const updateState = [
  authenticateAdmin,
  validateBody(['id', 'name', 'country_id'], [
    body('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
    body('name').notEmpty().trim().withMessage('name is required'),
    body('country_id').isInt({ min: 1 }).withMessage('country_id must be a positive integer'),
  ]),
  adminAsyncHandler(async (req, res) => {
    const id = BigInt(req.body.id);
    const countryId = BigInt(req.body.country_id);

    const existing = await prisma.state.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('State not found');

    const country = await prisma.country.findUnique({ where: { id: countryId } });
    if (!country) throw AppError.notFound('Country not found');

    const state = await prisma.state.update({
      where: { id },
      data: { name: req.body.name, country_id: countryId },
    });
    return sendSuccess(res, 'State updated', serialize(state));
  }),
];

export const deleteState = [
  authenticateAdmin,
  param('id').isNumeric(),
  validate([param('id').isNumeric()]),
  adminAsyncHandler(async (req, res) => {
    const id = BigInt(routeParam(req.params.id));
    const existing = await prisma.state.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('State not found');

    await prisma.state.delete({ where: { id } });
    return sendSuccess(res, 'State deleted');
  }),
];

export const listCities = [
  authenticateAdmin,
  validateQuery(['state_id'], [query('state_id').optional().isInt({ min: 1 }).withMessage('state_id must be a positive integer')]),
  adminAsyncHandler(async (req, res) => {
    const stateId = req.query.state_id ? BigInt(String(req.query.state_id)) : undefined;
    const cities = await prisma.city.findMany({
      where: stateId ? { state_id: stateId } : undefined,
      include: { state: { include: { country: true } } },
      orderBy: { name: 'asc' },
    });
    return sendSuccess(res, 'Cities fetched', serialize(cities));
  }),
];

export const createCity = [
  authenticateAdmin,
  validateBody(['name', 'state_id'], [
    body('name').notEmpty().trim().withMessage('name is required'),
    body('state_id').isInt({ min: 1 }).withMessage('state_id must be a positive integer'),
  ]),
  adminAsyncHandler(async (req, res) => {
    const stateId = BigInt(req.body.state_id);
    const state = await prisma.state.findUnique({ where: { id: stateId } });
    if (!state) throw AppError.notFound('State not found');

    const city = await prisma.city.create({
      data: { name: req.body.name, state_id: stateId },
    });
    return sendSuccess(res, 'City created', serialize(city), 201);
  }),
];

export const updateCity = [
  authenticateAdmin,
  validateBody(['id', 'name', 'state_id'], [
    body('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
    body('name').notEmpty().trim().withMessage('name is required'),
    body('state_id').isInt({ min: 1 }).withMessage('state_id must be a positive integer'),
  ]),
  adminAsyncHandler(async (req, res) => {
    const id = BigInt(req.body.id);
    const stateId = BigInt(req.body.state_id);

    const existing = await prisma.city.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('City not found');

    const state = await prisma.state.findUnique({ where: { id: stateId } });
    if (!state) throw AppError.notFound('State not found');

    const city = await prisma.city.update({
      where: { id },
      data: { name: req.body.name, state_id: stateId },
    });
    return sendSuccess(res, 'City updated', serialize(city));
  }),
];

export const deleteCity = [
  authenticateAdmin,
  param('id').isNumeric(),
  validate([param('id').isNumeric()]),
  adminAsyncHandler(async (req, res) => {
    const id = BigInt(routeParam(req.params.id));
    const existing = await prisma.city.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('City not found');

    await prisma.city.delete({ where: { id } });
    return sendSuccess(res, 'City deleted');
  }),
];
