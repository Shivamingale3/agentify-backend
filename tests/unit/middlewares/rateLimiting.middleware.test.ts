import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { RATE_LIMIT_DEFAULT_MESSAGE, RATE_LIMITS } from '#constants/ratelimits.constants.js';
import { createRateLimiter, globalRateLimiter } from '#middlewares/rateLimiting.middleware.js';
import { logger } from '#utils/logger.js';

vi.mock('#utils/logger.js', () => ({ logger: { warn: vi.fn() } }));

function appWith(limiter: express.RequestHandler): express.Express {
  const app = express();
  app.use(limiter);
  app.all('/ping', (_req, res) => res.json({ ok: true }));
  return app;
}

async function hit(app: express.Express, times: number): Promise<request.Response> {
  let res = await request(app).get('/ping');
  for (let i = 1; i < times; i++) res = await request(app).get('/ping');
  return res;
}

describe('createRateLimiter', () => {
  it('lets requests through up to the limit without rate-limit headers', async () => {
    const res = await hit(appWith(createRateLimiter('CREATE_INCIDENT')), 5);
    expect(res.status).toBe(200);
    expect(res.headers['ratelimit-limit']).toBeUndefined();
    expect(res.headers['retry-after']).toBeUndefined();
  });

  it('blocks the next request with 429, headers and the configured message', async () => {
    const { maxRequests, windowMs, message } = RATE_LIMITS.CREATE_INCIDENT;
    const res = await hit(appWith(createRateLimiter('CREATE_INCIDENT')), maxRequests + 1);

    expect(res.status).toBe(429);
    expect(res.body).toEqual({ success: false, message });
    const seconds = String(Math.ceil(windowMs / 1000));
    expect(res.headers).toMatchObject({
      'ratelimit-limit': String(maxRequests),
      'ratelimit-remaining': '0',
      'ratelimit-reset': seconds,
      'retry-after': seconds,
    });
    expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
      expect.stringMatching(/^Rate limit \[CREATE_INCIDENT\] hit by .+ on GET \/ping$/),
    );
  });

  it('uses the half-minute window for UPDATE_INCIDENT', async () => {
    const res = await hit(appWith(createRateLimiter('UPDATE_INCIDENT')), 6);
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBe('30');
    expect(res.body).toEqual({ success: false, message: RATE_LIMITS.UPDATE_INCIDENT.message });
  });

  it('falls back to the default message when the config has none (GLOBAL)', async () => {
    const res = await hit(appWith(createRateLimiter('GLOBAL')), RATE_LIMITS.GLOBAL.maxRequests + 1);
    expect(res.status).toBe(429);
    expect(res.body).toEqual({ success: false, message: RATE_LIMIT_DEFAULT_MESSAGE });
    expect(res.headers['ratelimit-limit']).toBe(String(RATE_LIMITS.GLOBAL.maxRequests));
  });

  it('keeps separate counters per limiter instance', async () => {
    await hit(appWith(createRateLimiter('CREATE_INCIDENT')), 6);
    const res = await request(appWith(createRateLimiter('CREATE_INCIDENT'))).get('/ping');
    expect(res.status).toBe(200);
  });
});

describe('globalRateLimiter', () => {
  it('is a ready-made GLOBAL limiter', async () => {
    const res = await request(appWith(globalRateLimiter)).get('/ping');
    expect(res.status).toBe(200);
  });
});

// Regression: Retry-After used to be the full window even late in the window.
describe('Retry-After', () => {
  it('reports the time left in the window, not the full window', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const { maxRequests, windowMs } = RATE_LIMITS.CREATE_INCIDENT;
      const app = appWith(createRateLimiter('CREATE_INCIDENT'));
      await hit(app, maxRequests);
      vi.setSystemTime(Date.now() + windowMs - 10_000); // 10s before the window resets

      const res = await request(app).get('/ping');

      expect(res.status).toBe(429);
      expect(res.headers['retry-after']).toBe('10');
      expect(res.headers['ratelimit-reset']).toBe('10');
    } finally {
      vi.useRealTimers();
    }
  });
});
