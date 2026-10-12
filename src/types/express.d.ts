import type { RateLimitInfo } from 'express-rate-limit';

// express-rate-limit sets `req.rateLimit` at runtime but doesn't type it.
declare global {
  namespace Express {
    interface Request {
      rateLimit?: RateLimitInfo;
    }
  }
}
