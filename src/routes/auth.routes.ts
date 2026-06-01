import { Router } from 'express';
import * as auth from '../controllers/auth.controller';
import * as upload from '../controllers/upload.controller';

const router = Router();

router.post('/register', auth.register);
router.post('/login', auth.login);
router.post('/logout', auth.logout);
router.post('/check-availability', auth.checkEmail);
router.post('/internal/token', auth.internalToken);
router.get('/me', auth.me);
router.delete('/account', auth.deleteAccount);
router.post('/change-password', auth.changePassword);

router.post('/otp/verify', auth.verifyOtp);
router.post('/otp/resend', auth.resendOtp);

router.get('/onboarding/status', auth.profileStatus);
router.post('/onboarding/profile/step-1', auth.profileStep1);
router.post('/onboarding/profile/step-2', auth.profileStep2);

export default router;
