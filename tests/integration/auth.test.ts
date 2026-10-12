import { Queue } from 'bullmq';
import { createClient } from 'redis';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '#app.js';
import { db } from '#providers/db.provider.js';
import { env } from '#providers/env.provider.js';
import authService from '#services/auth.service.js';
import cacheService from '#services/cache.service.js';
import { QUEUES } from '#services/queue.service.js';

// Integration test: real Postgres + Redis (Testcontainers), real HTTP stack via supertest.
// Tables and Redis are wiped before each test (see setup.ts), so tests can't see each other's data.

const newUser = { email: 'jane@example.com', password: 'Passw0rd!', firstName: 'Jane' };

// Inspectors on their own connections (the app's are closed by setup.ts).
const jobs = new Queue(QUEUES.JOBS, {
  connection: { host: env.QUEUE_HOST, port: env.QUEUE_PORT, password: env.QUEUE_PASS },
});
const redis = createClient({ url: env.CACHE_URL, password: env.CACHE_PASS });

beforeAll(async () => {
  await redis.connect();
});

afterAll(async () => {
  await Promise.all([jobs.close(), redis.close()]);
});

async function registerAndGetToken(): Promise<string> {
  await request(app).post('/api/auth/register').send(newUser).expect(200);
  const task = await db.public.TemporaryTasks.first();
  if (!task) throw new Error('expected a verification task');
  return task.token;
}

describe('POST /api/auth/register', () => {
  it('creates an unverified user and a verification task', async () => {
    const res = await request(app).post('/api/auth/register').send(newUser);

    expect(res.status).toBe(200);
    const user = await db.public.User.first({ email: newUser.email });
    expect(user).toMatchObject({ firstName: 'Jane', emailVerified: false });
    expect(user?.password).not.toBe(newUser.password);

    const tasks = await db.public.TemporaryTasks.all().toArray();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      taskType: 'EMAIL_VERIFICATION',
      taskData: { email: newUser.email },
    });
  });

  it('returns 409 for a duplicate email and leaves no extra rows', async () => {
    await request(app).post('/api/auth/register').send(newUser).expect(200);

    const res = await request(app).post('/api/auth/register').send(newUser);

    expect(res.status).toBe(409);
    expect(await db.public.User.all().toArray()).toHaveLength(1);
    expect(await db.public.TemporaryTasks.all().toArray()).toHaveLength(1);
  });

  it('rejects an invalid body with 400 before touching the DB', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(await db.public.User.all().toArray()).toHaveLength(0);
  });
});

describe('authService.verifyEmail', () => {
  it('marks the user verified and makes the token single-use', async () => {
    await request(app).post('/api/auth/register').send(newUser).expect(200);
    const task = await db.public.TemporaryTasks.first();
    if (!task) throw new Error('expected a verification task');

    await authService.verifyEmail(task.token);

    expect(await db.public.User.first({ email: newUser.email })).toMatchObject({
      emailVerified: true,
    });
    expect(await db.public.TemporaryTasks.first({ token: task.token })).toBeNull();
    await expect(authService.verifyEmail(task.token)).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('register side effects (after commit)', () => {
  it('enqueues one verification email job carrying the token link', async () => {
    const token = await registerAndGetToken();

    const waiting = await jobs.getWaiting();
    expect(waiting).toHaveLength(1);
    expect(waiting[0]?.name).toBe('email');
    expect(waiting[0]?.data).toMatchObject({
      type: 'email',
      data: { to: newUser.email, subject: 'Email Verification' },
    });
    expect(JSON.stringify(waiting[0]?.data)).toContain(
      `${env.FRONTEND_URL}/verify-email?token=${token}`,
    );
  });

  it('caches the verification payload under the token with a ~1h TTL', async () => {
    const token = await registerAndGetToken();

    const cached = await cacheService.get(token);
    expect(cached).toMatchObject({ token, email: newUser.email });
    const pttl = await redis.pTTL(token);
    expect(pttl).toBeGreaterThan(59 * 60 * 1000);
    expect(pttl).toBeLessThanOrEqual(60 * 60 * 1000);
  });

  it('does not enqueue or cache anything when registration conflicts', async () => {
    await registerAndGetToken();
    await cacheService.flush();

    await request(app).post('/api/auth/register').send(newUser).expect(409);

    expect(await jobs.getWaitingCount()).toBe(0);
    expect(await redis.dbSize()).toBe(0);
  });
});

describe('authService.verifyEmail edge cases', () => {
  it('falls back to the DB task when the cache entry is gone', async () => {
    const token = await registerAndGetToken();
    await cacheService.flush();

    await authService.verifyEmail(token);

    expect(await db.public.User.first({ email: newUser.email })).toMatchObject({
      emailVerified: true,
    });
  });

  it('removes the cache entry after a successful verification', async () => {
    const token = await registerAndGetToken();

    await authService.verifyEmail(token);

    expect(await redis.exists(token)).toBe(0);
  });

  it('rejects an unknown token with 401 Invalid token', async () => {
    await expect(authService.verifyEmail('nope')).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid token',
    });
  });

  it('rejects an expired token with 401 and leaves the user unverified', async () => {
    const user = await db.public.User.create({
      firstName: null,
      lastName: null,
      countryCode: null,
      mobile: null,
      email: newUser.email,
      emailVerified: false,
      password: 'hashed',
    });
    const token = 'expired-token';
    await db.public.TemporaryTasks.create({
      token,
      taskType: 'EMAIL_VERIFICATION',
      taskData: {
        token,
        email: user.email,
        userId: user.id,
        validTill: new Date(Date.now() - 1000).toISOString(),
      },
    });

    await expect(authService.verifyEmail(token)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Token expired',
    });
    expect(await db.public.User.first({ id: user.id })).toMatchObject({ emailVerified: false });
  });

  it('rejects a cached token whose DB task was already consumed', async () => {
    const token = await registerAndGetToken();
    await db.public.TemporaryTasks.where({ token }).delete();

    await expect(authService.verifyEmail(token)).rejects.toMatchObject({ statusCode: 401 });
    expect(await db.public.User.first({ email: newUser.email })).toMatchObject({
      emailVerified: false,
    });
  });
});
