import { Router } from 'express';
import authController from '#controller/auth.controller.js';
import { validationMiddleware } from '#middlewares/validation.middleware.js';
import registerSchema from '#validationSchemas/auth/register.schema.js';
import loginSchema from '#validationSchemas/auth/login.schema.js';

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
      authController.login.bind(authController),
    );
  }
}

const authRouter = new AuthRouter();
export default authRouter.router;
