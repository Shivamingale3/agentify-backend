import { CookieService } from '@/auth/cookie.service.js';
import { SessionService, sessionCacheKey } from '@/auth/session.service.js';
import { authTokenPayloadSchema } from '@/auth/token-payload.schema.js';
import { CacheService } from '@/cache/cache.service.js';
import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { z } from 'zod';

// Only the id is needed from the cached session (login caches the whole row).
const cachedSessionSchema = z.object({ id: z.string() });

/**
 * Lets through only requests whose auth cookie belongs to the user's current session, and sets
 * req.user. A newer login or a logout revokes older tokens at once.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly cookies: CookieService,
    private readonly cache: CacheService,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.cookies.getAuthCookie(request);
    if (!token) throw new UnauthorizedException('Not authenticated');

    let payload: unknown;
    try {
      // Checks the signature, the pinned algorithm and expiry.
      payload = await this.jwt.verifyAsync(token);
    } catch {
      // One message for every failure, so the reply doesn't say why a token was rejected.
      throw new UnauthorizedException('Not authenticated');
    }
    const parsed = authTokenPayloadSchema.safeParse(payload);
    if (!parsed.success) throw new UnauthorizedException('Not authenticated');

    // One session per user: the token is only valid while its session is still the current one.
    // The cache answers most requests; the DB row decides when the cache has nothing.
    const { userId, sessionId } = parsed.data;
    const current =
      (await this.cache.get(sessionCacheKey(userId), cachedSessionSchema)) ??
      (await this.sessions.findByUserId(userId));
    if (current?.id !== sessionId) throw new UnauthorizedException('Not authenticated');

    request.user = parsed.data;
    return true;
  }
}
