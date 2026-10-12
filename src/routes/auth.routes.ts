import { Router } from 'express';
import authController from '#controller/auth.controller.js';
import { validationMiddleware } from '#middlewares/validation.middleware.js';
import registerSchema from '#validationSchemas/auth/register.schema.js';

const authRouter = Router();
authRouter.post(
  '/register',
  validationMiddleware(registerSchema, 'body'),
  authController.register.bind(authController),
);
export default authRouter;
