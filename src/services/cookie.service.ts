import { env } from '#providers/env.provider.js';
import type { Request, Response } from 'express';

class CookieService {
  public setAuthCookie(response: Response, token: string): void {
    response.cookie(env.AUTH_COOKIE_NAME, token, {
      maxAge: 10 * 60 * 1000, // 10 minutes
      httpOnly: true,
      secure: env.APP_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
  }

  public setRefreshCookie(response: Response, token: string): void {
    response.cookie(env.REFRESH_COOKIE_NAME, token, {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      secure: env.APP_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
  }

  public getAuthCookie(request: Request): string | null {
    if (request.cookies[env.AUTH_COOKIE_NAME]) {
      return String(request.cookies[env.AUTH_COOKIE_NAME]);
    }
    return null;
  }

  public getRefreshCookie(request: Request): string | null {
    if (request.cookies[env.REFRESH_COOKIE_NAME]) {
      return String(request.cookies[env.REFRESH_COOKIE_NAME]);
    }
    return null;
  }

  public clearCookies(response: Response): void {
    response.clearCookie(env.AUTH_COOKIE_NAME, {
      path: '/',
      httpOnly: true,
      secure: env.APP_ENV === 'production',
      sameSite: 'strict',
    });
    response.clearCookie(env.REFRESH_COOKIE_NAME, {
      path: '/',
      httpOnly: true,
      secure: env.APP_ENV === 'production',
      sameSite: 'strict',
    });
  }
}
const cookieService = new CookieService();
export default cookieService;
