import { CookieService } from '@/auth/cookie.service.js';
import type { Env } from '@/config/env/env.schema.js';
import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

const env: Record<string, unknown> = {
  APP_ENV: 'production',
  AUTH_COOKIE_NAME: 'auth',
  REFRESH_COOKIE_NAME: 'refresh',
  AUTH_EXPIRY: 30,
  REFRESH_EXPIRY: 3600,
};
const config = { get: (key: string) => env[key] } as unknown as ConfigService<Env, true>;

let service: CookieService;
let response: { cookie: ReturnType<typeof vi.fn>; clearCookie: ReturnType<typeof vi.fn> };

beforeEach(() => {
  service = new CookieService(config);
  response = { cookie: vi.fn(), clearCookie: vi.fn() };
});

describe('CookieService', () => {
  it('sets the auth cookie maxAge from AUTH_EXPIRY, httpOnly and strict', () => {
    service.setAuthCookie(response as unknown as Response, 'a');
    expect(response.cookie).toHaveBeenCalledWith('auth', 'a', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 30_000,
    });
  });

  it('sets the refresh cookie maxAge from REFRESH_EXPIRY', () => {
    service.setRefreshCookie(response as unknown as Response, 'r');
    expect(response.cookie).toHaveBeenCalledWith(
      'refresh',
      'r',
      expect.objectContaining({ maxAge: 3_600_000 }),
    );
  });

  it('reads the auth cookie, or null when missing or empty', () => {
    const request = (cookies: Record<string, unknown>): Request => ({ cookies }) as Request;
    expect(service.getAuthCookie(request({ auth: 'tok' }))).toBe('tok');
    expect(service.getAuthCookie(request({ auth: '' }))).toBeNull();
    expect(service.getAuthCookie(request({}))).toBeNull();
  });
});
