import type { NextFunction, Request, Response } from 'express';
import type { RegisterDto } from '../types/auth.types';
import { ApiResponse } from '../lib/apiResponse';

class AuthController {
  public register(request: Request, response: Response, next: NextFunction): void {
    try {
      const data = request.body as RegisterDto;
      response.json(ApiResponse.success('Registered successfully', data));
    } catch (error) {
      next(error);
    }
  }
}
const authController = new AuthController();
export default authController;
