import type { CookieService } from '@/auth/cookie.service.js';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard.js';
import type { SessionService } from '@/auth/session.service.js';
import type { CacheService } from '@/cache/cache.service.js';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

const validPayload = { userId: 'u1', email: 'a@example.com', sessionId: 's1' };

interface Options {
  token?: string | null;
  verify?: () => Promise<unknown>;
  cached?: { id: string } | null;
  stored?: { id: string } | null;
}

function setup({
  token = 'tok',
  verify = () => Promise.resolve(validPayload),
  cached = { id: 's1' },
  stored = null,
}: Options = {}) {
  const request = {} as Request;
  const sessions = { findByUserId: vi.fn(() => Promise.resolve(stored)) };
  const guard = new JwtAuthGuard(
    { verifyAsync: vi.fn(verify) } as unknown as JwtService,
    { getAuthCookie: () => token } as unknown as CookieService,
    { get: () => Promise.resolve(cached) } as unknown as CacheService,
    sessions as unknown as SessionService,
  );
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { guard, context, request, sessions };
}

describe('JwtAuthGuard', () => {
  it('lets a valid token for the current session through and sets req.user', async () => {
    const { guard, context, request, sessions } = setup();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual(validPayload);
    expect(sessions.findByUserId).not.toHaveBeenCalled(); // the cache answered
  });

  it('rejects a request without the auth cookie', async () => {
    const { guard, context } = setup({ token: null });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token that fails verification (bad signature, expired, …)', async () => {
    const { guard, context } = setup({ verify: () => Promise.reject(new Error('jwt expired')) });

    await expect(guard.canActivate(context)).rejects.toThrow('Not authenticated');
  });

  it('rejects a validly signed token with the wrong payload shape', async () => {
    const { guard, context, request } = setup({ verify: () => Promise.resolve({ userId: 'u1' }) });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(request.user).toBeUndefined();
  });

  it('rejects a token whose session was replaced by a newer login', async () => {
    const { guard, context } = setup({ cached: { id: 's2' } });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('falls back to the DB on a cache miss', async () => {
    const { guard, context, sessions } = setup({ cached: null, stored: { id: 's1' } });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(sessions.findByUserId).toHaveBeenCalledWith('u1');
  });

  it('rejects a token after logout (no session anywhere)', async () => {
    const { guard, context } = setup({ cached: null, stored: null });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
