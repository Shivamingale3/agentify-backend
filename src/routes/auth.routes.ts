import { Router } from 'express';
import authController from '#controller/auth.controller.js';
import { validationMiddleware } from '#middlewares/validation.middleware.js';
import registerSchema from '#validationSchemas/auth/register.schema.js';
import loginSchema from '#validationSchemas/auth/login.schema.js';
import deviceHeadersSchema from '#validationSchemas/auth/deviceHeaders.schema.js';

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
      // Only login reads x-client-name / x-client-type (stored on the session), so they're
      // validated here rather than globally in app.ts. The controller relies on this.
      validationMiddleware(deviceHeadersSchema, 'headers'),
      authController.login.bind(authController),
    );
  }
}

const authRouter = new AuthRouter();
export default authRouter.router;
