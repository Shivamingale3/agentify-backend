import { Router } from 'express';
import healthRouter from '#routes/health.routes.js';
import authRouter from '#routes/auth.routes.js';

export const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
