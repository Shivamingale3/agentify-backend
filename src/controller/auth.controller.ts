import type { Request, Response } from 'express';
import type { ExtraDeviceHeaders, LoginDto, RegisterDto } from '#types/auth.types.js';
import { ApiResponse } from '#lib/apiResponse.js';
import authService from '#services/auth.service.js';
import cookieService from '#services/cookie.service.js';
import { HttpException } from '#exceptions/http.exception.js';
import { StatusCodes } from 'http-status-codes';

// No try/catch here: Express 5 forwards a rejected async handler to the error middleware itself.
// Add one only if the catch does something (maps, logs with context, cleans up), never just next(error).
class AuthController {
  public async register(request: Request, response: Response): Promise<void> {
    const payload = request.body as RegisterDto;
    await authService.register(payload);
    // 201: a user resource was created.
    response.status(StatusCodes.CREATED).json(ApiResponse.success('Registered successfully', null));
  }

  public async login(request: Request, response: Response): Promise<void> {
    const payload = request.body as LoginDto;
    // Safe cast: the /login route runs deviceHeadersSchema on req.headers (see auth.routes.ts).
    const headers = request.headers as ExtraDeviceHeaders;
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
}
const authController = new AuthController();
export default authController;
