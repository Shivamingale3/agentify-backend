import type { Request, Response } from 'express';
import type {
  ExtraDeviceHeaders,
  LoginDto,
  RegisterDto,
  VarifyEmailPayload,
} from '#types/auth.types.js';
import { ApiResponse } from '#lib/apiResponse.js';
import authService from '#services/auth.service.js';
import cookieService from '#services/cookie.service.js';
import { HttpException } from '#exceptions/http.exception.js';
import { StatusCodes } from 'http-status-codes';

// No try/catch here: Express 5 forwards a rejected async handler to the error middleware itself.
// Add one only if the catch does something (maps, logs with context, cleans up), never just next(error).
class AuthController {
  public async register(
    request: Request<unknown, unknown, RegisterDto>,
    response: Response,
  ): Promise<void> {
    const payload = request.body;
    await authService.register(payload);
    response.status(StatusCodes.CREATED).json(ApiResponse.success('Registered successfully', null));
  }

  public async login(
    request: Request<unknown, ExtraDeviceHeaders, LoginDto>,
    response: Response,
  ): Promise<void> {
    const payload = request.body;
    const headers = request.headers;
    const tokens = await authService.login(payload, headers);
    cookieService.setAuthCookie(response, tokens.authToken);
    cookieService.setRefreshCookie(response, tokens.refreshToken);
    response.json(ApiResponse.success('Logged in successfully', null));
  }

  public async logout(request: Request, response: Response): Promise<void> {
    const user = request.user;
    if (!user?.userId || !user.sessionId) {
      throw new HttpException(StatusCodes.UNAUTHORIZED, 'Invalid request');
    }
    await authService.clearSession(user.userId);
    cookieService.clearCookies(response);
    response.json(ApiResponse.success('Logged out successfully', null));
  }

  public async verifyEmail(
    request: Request<unknown, unknown, unknown, VarifyEmailPayload>,
    response: Response,
  ): Promise<void> {
    const key = request.query.key;
    if (!key) {
      throw new HttpException(StatusCodes.BAD_REQUEST, 'Key is required');
    }
    await authService.verifyEmail(key);
    response.json(ApiResponse.success('Email verified successfully', null));
  }
}
const authController = new AuthController();
export default authController;
