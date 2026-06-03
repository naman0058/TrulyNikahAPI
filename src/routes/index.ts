import { Router } from 'express';
import config from '../config';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import adminRoutes from './admin.routes';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'TrulyNikah API v1',
    ...(config.swagger.enabled ? { docs: `${config.appUrl}/api-docs` } : {}),
    health: `${config.appUrl}/health`,
    endpoints: {
      public: [
        'GET /locations/countries',
        'GET /plans',
        'GET /faqs',
        'GET /blogs',
        'GET /stories',
        'GET /policies/:type',
        'GET /counters',
        'POST /auth/register',
        'POST /auth/login',
        'POST /auth/mobile/send-otp',
        'POST /auth/mobile/verify-otp',
      ],
      authenticated: [
        'GET /auth/me',
        'DELETE /auth/account',
        'GET /me/profile',
        'GET /dashboard',
        'GET /profiles/best-matches',
        'POST /search',
        'POST /payments/razorpay/verify',
        'GET /payments/history',
        'GET /me/gallery',
      ],
      admin: [
        'POST /admin/auth/login',
        'GET /admin/dashboard',
        'GET /admin/members',
        'PATCH /admin/members/:userId',
      ],
    },
  });
});

router.use('/auth', authRoutes);
router.use('/', userRoutes);
router.use('/admin', adminRoutes);

export default router;
