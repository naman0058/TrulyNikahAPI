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
  });

  const shutdown = async () => {
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap();
