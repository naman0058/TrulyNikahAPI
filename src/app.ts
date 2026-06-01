import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import config from './config';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { swaggerSpec, swaggerUiOptions } from './docs/swagger';

/** Helmet defaults block Swagger UI "Execute" from showing responses (CSP / COEP). */
const swaggerHelmet = helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      ...(config.env === 'development' ? { contentSecurityPolicy: false } : {}),
    })
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || config.corsOrigins.includes(origin) || config.env === 'development') {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    })
  );

  app.get('/health', (_req, res) => {
    res.json({
      success: true,
      message: 'TrulyNikah API is running',
      env: config.env,
      timestamp: new Date().toISOString(),
    });
  });

  // OpenAPI JSON spec + Swagger UI (optional — controlled by SWAGGER_ENABLED)
  if (config.swagger.enabled) {
    app.get('/api-docs.json', (_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerSpec);
    });

    app.use(
      '/api-docs',
      swaggerHelmet,
      swaggerUi.serve,
      swaggerUi.setup(undefined, {
        ...swaggerUiOptions,
        swaggerOptions: {
          ...swaggerUiOptions.swaggerOptions,
          url: '/api-docs.json',
        },
      })
    );
  }

  app.use(compression());
  app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use(
    rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.max,
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => req.path.startsWith('/api-docs'),
    })
  );

  app.use('/media', express.static(path.resolve(config.upload.dir)));
  app.use(config.apiPrefix, routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
