import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import {
  RATE_LIMIT_DEFAULT_MESSAGE,
  RATE_LIMITS,
  type RateLimitKey,
} from '../constants/ratelimits.constants.js';
import { logger } from '../utils/logger.js';

export function createRateLimiter(configKey: RateLimitKey): RateLimitRequestHandler {
  const config = RATE_LIMITS[configKey];
  const message = 'message' in config ? config.message : RATE_LIMIT_DEFAULT_MESSAGE;

  return rateLimit({
    windowMs: config.windowMs,
    limit: config.maxRequests,
    standardHeaders: false,
    legacyHeaders: false,
    handler: (_req, res, _next, options) => {
      const retryAfterSeconds = Math.ceil(config.windowMs / 1000);

      res.setHeader('RateLimit-Limit', config.maxRequests);
      res.setHeader('RateLimit-Remaining', 0);
      res.setHeader('RateLimit-Reset', retryAfterSeconds);
      res.setHeader('Retry-After', retryAfterSeconds);

      logger.warn(
        `Rate limit [${configKey}] hit by ${_req.ip ?? 'unknown'} on ${_req.method} ${_req.originalUrl}`,
      );

      res.status(options.statusCode).json({
        success: false,
        message,
      });
    },
  });
}

export const globalRateLimiter = createRateLimiter('GLOBAL');
