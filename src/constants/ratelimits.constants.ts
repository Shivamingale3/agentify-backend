interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

const ONE_MINUTE_MS = 60 * 1000;
const HALF_MINUTE_MS = 30 * 1000;

export const RATE_LIMIT_DEFAULT_MESSAGE = 'Too many requests, please try again later.';

export const RATE_LIMITS = {
  GLOBAL: {
    windowMs: ONE_MINUTE_MS,
    maxRequests: 60,
  },

  CREATE_INCIDENT: {
    windowMs: ONE_MINUTE_MS,
    maxRequests: 5,
    message: 'Too many incidents created. Please try again later.',
  },

  UPDATE_INCIDENT: {
    windowMs: HALF_MINUTE_MS,
    maxRequests: 5,
    message: 'Too many update requests. Please try again later.',
  },

  SUGGEST_SEVERITY: {
    windowMs: HALF_MINUTE_MS,
    maxRequests: 10,
    message: 'Too many suggestion requests. Please try again later.',
  },

  INCIDENT_AI_INSIGHTS: {
    windowMs: ONE_MINUTE_MS,
    maxRequests: 5,
    message: 'Too many AI insights requests. Please try again later.',
  },
} as const satisfies Record<string, RateLimitConfig>;

export type RateLimitKey = keyof typeof RATE_LIMITS;
