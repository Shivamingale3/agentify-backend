import type { Env } from '@/config/env/env.schema.js';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';

@Injectable()
export class CookieService {
  private readonly options: CookieOptions;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.options = {
      httpOnly: true,
      secure: config.get('APP_ENV', { infer: true }) === 'production',
      sameSite: 'strict',
      path: '/',
    };
  }

  setAuthCookie(response: Response, token: string): void {
    response.cookie(this.config.get('AUTH_COOKIE_NAME', { infer: true }), token, {
      ...this.options,
      maxAge: this.config.get('AUTH_EXPIRY', { infer: true }) * 1000, // same lifetime as the JWT
    });
  }

  setRefreshCookie(response: Response, token: string): void {
    response.cookie(this.config.get('REFRESH_COOKIE_NAME', { infer: true }), token, {
      ...this.options,
      maxAge: this.config.get('REFRESH_EXPIRY', { infer: true }) * 1000, // same lifetime as the JWT
    });
  }

  getAuthCookie(request: Request): string | null {
    const value: unknown = request.cookies[this.config.get('AUTH_COOKIE_NAME', { infer: true })];
    return typeof value === 'string' && value !== '' ? value : null;
  }

  clearCookies(response: Response): void {
    // Same options as when set (minus maxAge), or the browser treats it as a different cookie.
    response.clearCookie(this.config.get('AUTH_COOKIE_NAME', { infer: true }), this.options);
    response.clearCookie(this.config.get('REFRESH_COOKIE_NAME', { infer: true }), this.options);
  }
}
