import type { AuthTokenPayload } from '@/auth/token-payload.schema.js';

// JwtAuthGuard sets `req.user` from the verified auth token; read it with @CurrentUser().
declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}
