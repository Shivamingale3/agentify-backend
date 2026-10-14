import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import cookieService from '#services/cookie.service.js';

// Lifetimes deliberately differ from the old hard-coded 10 min / 24 h.
vi.mock('#providers/env.provider.js', () => ({
  env: {
    APP_ENV: 'test',
    AUTH_COOKIE_NAME: 'auth',
    REFRESH_COOKIE_NAME: 'refresh',
    AUTH_EXPIRY: 30,
    REFRESH_EXPIRY: 3600,
  },
}));

function fakeResponse(): Response & { cookie: ReturnType<typeof vi.fn> } {
  return { cookie: vi.fn() } as unknown as Response & { cookie: ReturnType<typeof vi.fn> };
}

describe('cookieService', () => {
  // Regression: maxAge was hard-coded and drifted from the JWT lifetimes in env.
  it('sets the auth cookie maxAge from AUTH_EXPIRY', () => {
    const response = fakeResponse();
    cookieService.setAuthCookie(response, 'a');
    expect(response.cookie).toHaveBeenCalledWith(
      'auth',
      'a',
      expect.objectContaining({ maxAge: 30_000 }),
    );
  });

  it('sets the refresh cookie maxAge from REFRESH_EXPIRY', () => {
    const response = fakeResponse();
    cookieService.setRefreshCookie(response, 'r');
    expect(response.cookie).toHaveBeenCalledWith(
      'refresh',
      'r',
      expect.objectContaining({ maxAge: 3_600_000 }),
    );
  });
});
