import { body, param } from 'express-validator';
import { AuthRequest, asyncHandler, fullUserGuard, validate, validateBody, wrapUpload } from '../middleware';
import prisma from '../lib/prisma';
import { sendSuccess, serialize } from '../utils/response';
import {
  PROFILE_IMAGE_FIELDS,
  ProfileImageField,
  toPublicMediaUrl,
  toStoragePath,
  uploadProfilePhoto,
} from '../middleware/upload';
import { AppError } from '../utils/errors';
import { UPLOAD_PHOTO_FIELDS } from '../utils/validation';

export const uploadPhoto = [
  ...fullUserGuard,
  wrapUpload(uploadProfilePhoto.single('photo')),
  validateBody([...UPLOAD_PHOTO_FIELDS], [
    body('field')
      .optional()
      .isIn([...PROFILE_IMAGE_FIELDS])
      .withMessage(`field must be one of: ${PROFILE_IMAGE_FIELDS.join(', ')}`),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const field = (req.body.field ?? 'profile_image') as ProfileImageField;
    if (!PROFILE_IMAGE_FIELDS.includes(field)) {
      throw AppError.badRequest(`Invalid field. Use one of: ${PROFILE_IMAGE_FIELDS.join(', ')}`, {
        field: [`Must be one of: ${PROFILE_IMAGE_FIELDS.join(', ')}`],
      });
    }
    if (!req.file) throw AppError.badRequest('Photo file is required', { photo: ['Photo file is required'] });

    const storagePath = toStoragePath(req.file.filename);
    await prisma.profileManager.upsert({
      where: { user_id: req.userId! },
      create: { user_id: req.userId!, [field]: storagePath },
      update: { [field]: storagePath },
    });

    const manager = await prisma.profileManager.findUnique({ where: { user_id: req.userId! } });
    const urls = manager
      ? Object.fromEntries(
          PROFILE_IMAGE_FIELDS.map((f) => [f, toPublicMediaUrl(manager[f as keyof typeof manager] as string)])
        )
      : {};

    return sendSuccess(res, 'Photo uploaded successfully', serialize({ field, path: storagePath, urls }));
  }),
];

export const getGallery = [
  ...fullUserGuard,
  asyncHandler(async (req: AuthRequest, res) => {
    const manager = await prisma.profileManager.findUnique({ where: { user_id: req.userId! } });
    if (!manager) return sendSuccess(res, 'Gallery fetched', { photos: {} });

    const photos = Object.fromEntries(
      PROFILE_IMAGE_FIELDS.map((f) => [f, toPublicMediaUrl(manager[f as keyof typeof manager] as string)])
    );
    return sendSuccess(res, 'Gallery fetched', serialize({ photos, paths: manager }));
  }),
];

export const deletePhoto = [
  ...fullUserGuard,
  validate([
    param('field')
      .trim()
      .notEmpty()
      .withMessage('field is required')
      .isIn([...PROFILE_IMAGE_FIELDS])
      .withMessage(`field must be one of: ${PROFILE_IMAGE_FIELDS.join(', ')}`),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const field = String(req.params.field) as ProfileImageField;
    if (!PROFILE_IMAGE_FIELDS.includes(field)) {
      throw AppError.badRequest(`Invalid field. Use one of: ${PROFILE_IMAGE_FIELDS.join(', ')}`, {
        field: [`Must be one of: ${PROFILE_IMAGE_FIELDS.join(', ')}`],
      });
    }

    const manager = await prisma.profileManager.findUnique({ where: { user_id: req.userId! } });
    if (!manager) throw AppError.notFound('No gallery found');

    await prisma.profileManager.update({
      where: { user_id: req.userId! },
      data: { [field]: null },
    });

    return sendSuccess(res, 'Photo removed', { field });
  }),
];
