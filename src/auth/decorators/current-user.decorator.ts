import type { AuthTokenPayload } from '@/auth/token-payload.schema.js';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** The authenticated user. Only valid on routes behind JwtAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthTokenPayload => {
    const { user } = context.switchToHttp().getRequest<Request>();
    // The guard always sets it, so a missing user is a wiring bug (route without the guard): a 500.
    if (!user) throw new Error('@CurrentUser() used on a route without JwtAuthGuard');
    return user;
  },
);
