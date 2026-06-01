import config from './config';
import { createApp } from './app';
import prisma from './lib/prisma';

// Serialize BigInt in JSON responses
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function () {
  return Number(this);
};

async function bootstrap() {
  const app = createApp();

  try {
    await prisma.$connect();
    console.log('[DB] Connected to MySQL');
  } catch (error) {
    console.error('[DB] Connection failed:', error);
    process.exit(1);
  }

  app.listen(config.port, () => {
    console.log(`[API] TrulyNikah API listening on port ${config.port}`);
    console.log(`[API] Base URL: ${config.appUrl}${config.apiPrefix}`);
    console.log(`[API] Environment: ${config.env}`);
    if (config.swagger.enabled) {
      console.log(`[API] Swagger: ${config.appUrl}/api-docs`);
      if (config.appUrl.startsWith('http://') && !config.appUrl.includes('localhost')) {
        console.warn(
          '[API] APP_URL uses HTTP on a public domain — browsers may force HTTPS (HSTS). ' +
            'Use nginx + SSL and set APP_URL=https://api.trulynikah.com'
        );
      }
    }
  });

  const shutdown = async () => {
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap();
