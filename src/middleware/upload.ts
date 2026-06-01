import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Request } from 'express';
import config from '../config';

const profileImagesDir = path.join(config.upload.dir, 'profile_images');

if (!fs.existsSync(profileImagesDir)) {
  fs.mkdirSync(profileImagesDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, profileImagesDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  },
});

function fileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, JPEG, PNG images are allowed'));
  }
}

export const uploadProfilePhoto = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.upload.maxMb * 1024 * 1024 },
});

/** Laravel stores paths like `profile_images/filename.jpg` */
export function toStoragePath(filename: string): string {
  return `profile_images/${filename}`;
}

export function toPublicMediaUrl(storagePath: string | null | undefined): string | null {
  if (!storagePath) return null;
  if (storagePath.startsWith('http')) return storagePath;
  return `${config.upload.publicMediaUrl}/${storagePath.replace(/^\/+/, '')}`;
}

export const PROFILE_IMAGE_FIELDS = [
  'profile_image',
  'profile_image1',
  'profile_image2',
  'profile_image3',
  'profile_image4',
] as const;

export type ProfileImageField = (typeof PROFILE_IMAGE_FIELDS)[number];
