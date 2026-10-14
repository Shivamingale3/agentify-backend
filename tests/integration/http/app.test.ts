import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '#app.js';
import { RATE_LIMITS } from '#constants/ratelimits.constants.js';

// Rate limits are keyed by req.ip; with `trust proxy` = 1, X-Forwarded-For sets it.
// Each test that cares uses its own IP so the in-memory limiter can't leak between tests.

describe('HTTP stack', () => {
  it('GET /api/health returns 200 with the health payload', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Server is healthy' });
  });

  it('unknown routes return the 404 JSON shape', async () => {
    const res = await request(app).get('/api/nope');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: 'Route not found' });
  });

  it('malformed JSON goes through the error middleware as a 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"email":');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: 'Malformed request body' });
  });

  it('validation errors return 400 with the first Zod issue message', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'jane@example.com', password: 'weak' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      message: expect.stringContaining('Password must be at least 8 characters long') as unknown,
    });
  });

  it('rate-limits a client after the global limit and answers 429 JSON', async () => {
    const ip = '203.0.113.7';
    const { maxRequests, windowMs } = RATE_LIMITS.GLOBAL;

    for (let i = 0; i < maxRequests; i++) {
      await request(app).get('/api/health').set('X-Forwarded-For', ip).expect(200);
    }
    const res = await request(app).get('/api/health').set('X-Forwarded-For', ip);

    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      success: false,
      message: 'Too many requests, please try again later.',
    });
    expect(res.headers['retry-after']).toBe(String(Math.ceil(windowMs / 1000)));

    // Another client is unaffected.
    await request(app).get('/api/health').set('X-Forwarded-For', '203.0.113.8').expect(200);
  });
});
