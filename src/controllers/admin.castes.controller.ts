import { body, param, query } from 'express-validator';
import { adminAsyncHandler, authenticateAdmin } from '../middleware/adminAuth';
import { validate, validateBody, validateQuery } from '../middleware';
import prisma from '../lib/prisma';
import { sendSuccess, serialize } from '../utils/response';
import { routeParam } from '../utils/helpers';
import { AppError } from '../utils/errors';

export const listCastes = [
  authenticateAdmin,
  adminAsyncHandler(async (_req, res) => {
    const castes = await prisma.caste.findMany({
      include: { _count: { select: { subCastes: true } } },
      orderBy: { caste: 'asc' },
    });
    return sendSuccess(res, 'Castes fetched', serialize(castes));
  }),
];

export const getCaste = [
  authenticateAdmin,
  param('id').isNumeric(),
  validate([param('id').isNumeric()]),
  adminAsyncHandler(async (req, res) => {
    const caste = await prisma.caste.findUnique({
      where: { id: BigInt(routeParam(req.params.id)) },
      include: { subCastes: { orderBy: { subcaste: 'asc' } } },
    });
    if (!caste) throw AppError.notFound('Caste not found');
    return sendSuccess(res, 'Caste fetched', serialize(caste));
  }),
];

export const createCaste = [
  authenticateAdmin,
  validateBody(['caste'], [body('caste').notEmpty().trim().withMessage('caste is required')]),
  adminAsyncHandler(async (req, res) => {
    const existing = await prisma.caste.findFirst({ where: { caste: req.body.caste } });
    if (existing) throw AppError.conflict('Caste already exists', { caste: ['Caste already exists'] });

    const caste = await prisma.caste.create({ data: { caste: req.body.caste } });
    return sendSuccess(res, 'Caste created', serialize(caste), 201);
  }),
];

export const updateCaste = [
  authenticateAdmin,
  validateBody(['id', 'caste'], [
    body('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
    body('caste').notEmpty().trim().withMessage('caste is required'),
  ]),
  adminAsyncHandler(async (req, res) => {
    const id = BigInt(req.body.id);
    const existing = await prisma.caste.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Caste not found');

    const duplicate = await prisma.caste.findFirst({
      where: { caste: req.body.caste, NOT: { id } },
    });
    if (duplicate) throw AppError.conflict('Caste already exists', { caste: ['Caste already exists'] });

    const caste = await prisma.caste.update({ where: { id }, data: { caste: req.body.caste } });
    return sendSuccess(res, 'Caste updated', serialize(caste));
  }),
];

export const deleteCaste = [
  authenticateAdmin,
  param('id').isNumeric(),
  validate([param('id').isNumeric()]),
  adminAsyncHandler(async (req, res) => {
    const id = BigInt(routeParam(req.params.id));
    const existing = await prisma.caste.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Caste not found');

    await prisma.caste.delete({ where: { id } });
    return sendSuccess(res, 'Caste deleted');
  }),
];

export const listSubCastes = [
  authenticateAdmin,
  validateQuery(['caste_id'], [query('caste_id').optional().isInt({ min: 1 }).withMessage('caste_id must be a positive integer')]),
  adminAsyncHandler(async (req, res) => {
    const casteId = req.query.caste_id ? BigInt(String(req.query.caste_id)) : undefined;
    const subCastes = await prisma.subCaste.findMany({
      where: casteId ? { caste_id: casteId } : undefined,
      include: { caste: true },
      orderBy: { subcaste: 'asc' },
    });
    return sendSuccess(res, 'Sub-castes fetched', serialize(subCastes));
  }),
];

export const getSubCaste = [
  authenticateAdmin,
  param('id').isNumeric(),
  validate([param('id').isNumeric()]),
  adminAsyncHandler(async (req, res) => {
    const subCaste = await prisma.subCaste.findUnique({
      where: { id: BigInt(routeParam(req.params.id)) },
      include: { caste: true },
    });
    if (!subCaste) throw AppError.notFound('Sub-caste not found');
    return sendSuccess(res, 'Sub-caste fetched', serialize(subCaste));
  }),
];

export const createSubCaste = [
  authenticateAdmin,
  validateBody(['subcaste', 'caste_id'], [
    body('subcaste').notEmpty().trim().withMessage('subcaste is required'),
    body('caste_id').isInt({ min: 1 }).withMessage('caste_id must be a positive integer'),
  ]),
  adminAsyncHandler(async (req, res) => {
    const casteId = BigInt(req.body.caste_id);
    const caste = await prisma.caste.findUnique({ where: { id: casteId } });
    if (!caste) throw AppError.notFound('Parent caste not found');

    const existing = await prisma.subCaste.findFirst({ where: { subcaste: req.body.subcaste } });
    if (existing) throw AppError.conflict('Sub-caste already exists', { subcaste: ['Sub-caste already exists'] });

    const subCaste = await prisma.subCaste.create({
      data: { subcaste: req.body.subcaste, caste_id: casteId },
    });
    return sendSuccess(res, 'Sub-caste created', serialize(subCaste), 201);
  }),
];

export const updateSubCaste = [
  authenticateAdmin,
  validateBody(['id', 'subcaste', 'caste_id'], [
    body('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
    body('subcaste').notEmpty().trim().withMessage('subcaste is required'),
    body('caste_id').isInt({ min: 1 }).withMessage('caste_id must be a positive integer'),
  ]),
  adminAsyncHandler(async (req, res) => {
    const id = BigInt(req.body.id);
    const casteId = BigInt(req.body.caste_id);

    const existing = await prisma.subCaste.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Sub-caste not found');

    const caste = await prisma.caste.findUnique({ where: { id: casteId } });
    if (!caste) throw AppError.notFound('Parent caste not found');

    const duplicate = await prisma.subCaste.findFirst({
      where: { subcaste: req.body.subcaste, NOT: { id } },
    });
    if (duplicate) throw AppError.conflict('Sub-caste already exists', { subcaste: ['Sub-caste already exists'] });

    const subCaste = await prisma.subCaste.update({
      where: { id },
      data: { subcaste: req.body.subcaste, caste_id: casteId },
    });
    return sendSuccess(res, 'Sub-caste updated', serialize(subCaste));
  }),
];

export const deleteSubCaste = [
  authenticateAdmin,
  param('id').isNumeric(),
  validate([param('id').isNumeric()]),
  adminAsyncHandler(async (req, res) => {
    const id = BigInt(routeParam(req.params.id));
    const existing = await prisma.subCaste.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Sub-caste not found');

    await prisma.subCaste.delete({ where: { id } });
    return sendSuccess(res, 'Sub-caste deleted');
  }),
];
