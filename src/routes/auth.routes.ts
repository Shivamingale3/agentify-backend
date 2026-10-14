import { Router } from 'express';
import authController from '#controller/auth.controller.js';
import { validationMiddleware } from '#middlewares/validation.middleware.js';
import registerSchema from '#validationSchemas/auth/register.schema.js';
import loginSchema from '#validationSchemas/auth/login.schema.js';
import deviceHeadersSchema from '#validationSchemas/auth/deviceHeaders.schema.js';
import verifyEmailSchema from '#validationSchemas/auth/verifyEmail.schema.js';

class AuthRouter {
  public readonly router: Router;

  constructor() {
    this.router = Router();
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.router.post(
      '/register',
      validationMiddleware(registerSchema, 'body'),
      authController.register.bind(authController),
    );
    this.router.post(
      '/login',
      validationMiddleware(loginSchema, 'body'),
      validationMiddleware(deviceHeadersSchema, 'headers'),
      authController.login.bind(authController),
    );
    this.router.post('/logout', authController.logout.bind(authController));
    this.router.post(
      '/verify-email',
      validationMiddleware(verifyEmailSchema, 'query'),
      authController.verifyEmail.bind(authController),
    );
  }
}

const authRouter = new AuthRouter();
export default authRouter.router;
