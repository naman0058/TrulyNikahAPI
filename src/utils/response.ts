import { Response } from 'express';
import { ErrorCode } from './errors';
import { enrichPayload } from '../services/user-display.service';

export type ApiResponse<T = unknown> = {
  success: boolean;
  message: string;
  code?: ErrorCode | string;
  data?: T;
  errors?: Record<string, string[]>;
  meta?: Record<string, unknown>;
};

export function sendSuccess<T>(
  res: Response,
  message: string,
  data?: T,
  status = 200,
  meta?: Record<string, unknown>
): Response {
  const body: ApiResponse<T> = { success: true, message };
  if (data !== undefined) body.data = data;
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

export function sendError(
  res: Response,
  message: string,
  status = 400,
  options?: {
    code?: ErrorCode | string;
    errors?: Record<string, string[]>;
    meta?: Record<string, unknown>;
  }
): Response {
  const body: ApiResponse = {
    success: false,
    message,
    code: options?.code,
    meta: { timestamp: new Date().toISOString(), ...options?.meta },
  };
  if (options?.errors) body.errors = options.errors;
  if (options?.errors) {
    body.meta = {
      ...body.meta,
      errorCount: Object.values(options.errors).reduce((sum, arr) => sum + arr.length, 0),
      fields: Object.keys(options.errors),
    };
  }
  return res.status(status).json(body);
}

export function serialize<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_key, value) => (typeof value === 'bigint' ? Number(value) : value))
  );
}

/** Resolve ID fields to *_name labels, then serialize BigInts for JSON. */
export async function enrichAndSerialize<T>(data: T) {
  return serialize(await enrichPayload(data));
}

export function paginationMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  };
}
