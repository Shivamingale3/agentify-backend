import type { NextFunction, Request, Response } from 'express';
import type { ExtraDeviceHeaders, LoginDto, RegisterDto } from '#types/auth.types.js';
import { ApiResponse } from '#lib/apiResponse.js';
import authService from '#services/auth.service.js';
import cookieService from '#services/cookie.service.js';
import { HttpException } from '#exceptions/http.exception.js';
import { StatusCodes } from 'http-status-codes';

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

  public async login(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      const payload = request.body as LoginDto;
      // Safe cast: the /login route runs deviceHeadersSchema on req.headers (see auth.routes.ts).
      const headers = request.headers as ExtraDeviceHeaders;
      const tokens = await authService.login(payload, headers);
      cookieService.setAuthCookie(response, tokens.authToken);
      cookieService.setRefreshCookie(response, tokens.refreshToken);
      response.json(ApiResponse.success('Logged in successfully', null));
    } catch (error) {
      next(error);
    }
  }

  public async logout(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      const user = request.user;
      if (!user?.userId || !user.sessionId) {
        throw new HttpException(StatusCodes.UNAUTHORIZED, 'Invalid request');
      }
      await authService.clearSession(user.userId, user.sessionId);
      cookieService.clearCookies(response);
      response.json(ApiResponse.success('Logged out successfully', null));
    } catch (error) {
      next(error);
    }
  }
}
const authController = new AuthController();
export default authController;
