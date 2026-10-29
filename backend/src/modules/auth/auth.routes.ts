import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { loginRateLimiter } from '../../middlewares/rate-limit.middleware';
import { authController } from './auth.controller';

export const authRouter = Router();

authRouter.post('/register', authController.register);
authRouter.post('/login', loginRateLimiter, authController.login);
authRouter.get('/me', requireAuth, authController.me);
