import { env } from '#providers/env.provider.js';
import type { Request, Response } from 'express';

class CookieService {
  public setAuthCookie(response: Response, token: string): void {
    response.cookie(env.AUTH_COOKIE_NAME, token, {
      maxAge: env.AUTH_EXPIRY * 1000, // same lifetime as the JWT inside it
      httpOnly: true,
      secure: env.APP_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
  }

  public setRefreshCookie(response: Response, token: string): void {
    response.cookie(env.REFRESH_COOKIE_NAME, token, {
      maxAge: env.REFRESH_EXPIRY * 1000, // same lifetime as the JWT inside it
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
