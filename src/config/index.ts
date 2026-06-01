import dotenv from 'dotenv';

dotenv.config();

function buildDatabaseUrl(): string {
  // Prefer DB_* vars — passwords with = ^ & etc. break raw DATABASE_URL strings
  if (process.env.DB_HOST && process.env.DB_DATABASE) {
    const host = process.env.DB_HOST;
    const port = process.env.DB_PORT ?? '3306';
    const database = process.env.DB_DATABASE;
    const username = process.env.DB_USERNAME ?? 'root';
    const password = encodeURIComponent(process.env.DB_PASSWORD ?? '');
    return `mysql://${username}:${password}@${host}:${port}/${database}`;
  }

  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const host = process.env.DB_HOST ?? '127.0.0.1';
  const port = process.env.DB_PORT ?? '3306';
  const database = process.env.DB_DATABASE ?? 'nikahmubarak';
  const username = process.env.DB_USERNAME ?? 'root';
  const password = encodeURIComponent(process.env.DB_PASSWORD ?? '');

  return `mysql://${username}:${password}@${host}:${port}/${database}`;
}

function originFromUrl(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** Merge CORS_ORIGINS with APP_URL and WEBSITE_URL origins (Swagger + website). */
function buildCorsOrigins(): string[] {
  const set = new Set(
    (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean)
  );

  const appUrl = process.env.APP_URL ?? 'http://localhost:4000';
  const websiteUrl = process.env.WEBSITE_URL ?? 'http://localhost';

  for (const origin of [originFromUrl(appUrl), originFromUrl(websiteUrl)]) {
    if (origin) set.add(origin);
  }

  return [...set];
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4000', 10),
  apiPrefix: process.env.API_PREFIX ?? '/api/v1',
  appUrl: process.env.APP_URL ?? 'http://localhost:4000',
  websiteUrl: process.env.WEBSITE_URL ?? 'http://localhost',
  corsOrigins: buildCorsOrigins(),
  databaseUrl: buildDatabaseUrl(),
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-jwt-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
    adminSecret: process.env.ADMIN_JWT_SECRET ?? 'dev-admin-secret-change-in-production',
    adminExpiresIn: process.env.ADMIN_JWT_EXPIRES_IN ?? '1d',
  },
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10),
  mtalkz: {
    url: process.env.MTALKZ_API_URL ?? 'https://msgn.mtalkz.com/api',
    key: process.env.MTALKZ_API_KEY ?? '',
    sender: process.env.MTALKZ_SENDER_ID ?? '',
    expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES ?? '15', 10),
    cooldownSeconds: parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS ?? '180', 10),
  },
  razorpay: {
    key: process.env.RAZORPAY_KEY ?? '',
    secret: process.env.RAZORPAY_SECRET ?? '',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX ?? '200', 10),
    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX ?? '10', 10),
  },
  internalApiSecret: process.env.INTERNAL_API_SECRET ?? '',
  upload: {
    dir: process.env.UPLOAD_DIR ?? './uploads',
    publicMediaUrl: process.env.PUBLIC_MEDIA_URL ?? 'http://localhost:4000/media',
    maxMb: parseInt(process.env.MAX_UPLOAD_MB ?? '5', 10),
  },
  swagger: {
    /** Set SWAGGER_ENABLED=false to disable /api-docs entirely */
    enabled: process.env.SWAGGER_ENABLED !== 'false',
    /** Comma-separated tags to include (empty = all tags). e.g. Auth,Public,Discovery */
    includeTags: (process.env.SWAGGER_TAGS ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    /** Comma-separated tags to hide. e.g. Admin */
    excludeTags: (process.env.SWAGGER_EXCLUDE_TAGS ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  },
} as const;

export default config;
