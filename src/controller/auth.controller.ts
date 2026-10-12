import type { NextFunction, Request, Response } from 'express';
import type { RegisterDto } from '#types/auth.types.js';
import { ApiResponse } from '#lib/apiResponse.js';
import authService from '#services/auth.service.js';

class AuthController {
  public async register(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      const payload = request.body as RegisterDto;
      await authService.register(payload);
      response.json(ApiResponse.success('Registered successfully', null));
    } catch (error) {
      next(error);
    }
  }
}
const authController = new AuthController();
export default authController;
