import { createHash } from 'node:crypto';
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
      expiresAt: Temporal.Now.instant().subtract({ seconds: 1 }),
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
    // Regression: the dead token is removed right away instead of lingering.
    expect(await db.public.TemporaryTasks.first({ token })).toBeNull();
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

describe('POST /api/auth/login', () => {
  // Regression: a weak password got a 400 naming the strength rule instead of the uniform 401.
  it('answers a weak wrong password with Invalid credentials, not the password policy', async () => {
    await request(app).post('/api/auth/register').send(newUser).expect(200);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: newUser.email, password: 'abc' })
      .expect(401);
    expect(res.body).toMatchObject({ message: 'Invalid credentials' });
  });

  // Regression: x-client-name had no length cap and was stored verbatim on the session.
  it('stores an oversized device header as Unknown and still logs in', async () => {
    await request(app).post('/api/auth/register').send(newUser).expect(200);
    await db.public.User.where({ email: newUser.email }).update({ emailVerified: true });

    await request(app)
      .post('/api/auth/login')
      .set('x-client-name', 'x'.repeat(5000))
      .set('x-client-type', 'web')
      .send({ email: newUser.email, password: newUser.password })
      .expect(200);

    expect(await db.public.Session.first()).toMatchObject({
      clientName: 'Unknown',
      clientType: 'web',
    });
  });

  // Regression: the raw refresh token was stored in sessions.token and the Redis session.
  it('stores only a SHA-256 hash of the refresh token', async () => {
    await request(app).post('/api/auth/register').send(newUser).expect(200);
    await db.public.User.where({ email: newUser.email }).update({ emailVerified: true });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: newUser.email, password: newUser.password })
      .expect(200);
    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    const refreshCookie = cookies.find((c) => c.startsWith(`${env.REFRESH_COOKIE_NAME}=`)) ?? '';
    const refreshToken = refreshCookie.split(';')[0]?.split('=')[1] ?? '';
    expect(refreshToken).not.toBe('');
    const digest = createHash('sha256').update(refreshToken).digest('hex');

    const session = await db.public.Session.first();
    expect(session?.token).toBe(digest);
    const cached = await redis.get(session?.id ?? '');
    expect(cached).not.toContain(refreshToken);
    expect(cached).toContain(digest);
  });

  // Regression: unknown emails got "User not found" and unverified ones were revealed before the password check.
  it.each([
    ['an unknown email', { email: 'nobody@example.com', password: newUser.password }],
    ['a wrong password on an unverified account', { email: newUser.email, password: 'Wr0ngPass!' }],
  ])('gives the same 401 for %s', async (_case, credentials) => {
    await request(app).post('/api/auth/register').send(newUser).expect(200);

    const res = await request(app).post('/api/auth/login').send(credentials).expect(401);
    expect(res.body).toMatchObject({ message: 'Invalid credentials' });
  });

  it('says the email is unverified only after the password matches', async () => {
    await request(app).post('/api/auth/register').send(newUser).expect(200);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: newUser.email, password: newUser.password })
      .expect(401);
    expect(res.body).toMatchObject({ message: 'Email not verified' });
  });

  // Regression: the second login hit the unique userId on sessions and returned 500.
  it('lets a verified user log in again, replacing their session', async () => {
    await request(app).post('/api/auth/register').send(newUser).expect(200);
    await db.public.User.where({ email: newUser.email }).update({ emailVerified: true });
    const credentials = { email: newUser.email, password: newUser.password };

    await request(app).post('/api/auth/login').send(credentials).expect(200);
    const first = await db.public.Session.first();
    await request(app).post('/api/auth/login').send(credentials).expect(200);

    const sessions = await db.public.Session.all().toArray();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.id).not.toBe(first?.id);
    expect(sessions[0]?.token).not.toBe(first?.token);

    // Redis holds only the current session, and it expires with the refresh token.
    const current = sessions[0]?.id ?? '';
    expect(await redis.exists(first?.id ?? '')).toBe(0);
    expect(await redis.pTTL(current)).toBeGreaterThan(0);
    expect(await redis.pTTL(current)).toBeLessThanOrEqual(env.REFRESH_EXPIRY * 1000);
  });
});

describe('email case', () => {
  // Regression: emails differing only in case created two accounts, and login was case-sensitive.
  it('treats differently-cased emails as the same account', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ ...newUser, email: 'Jane@Example.com' })
      .expect(200);
    await request(app).post('/api/auth/register').send(newUser).expect(409);

    expect(await db.public.User.all().toArray()).toMatchObject([{ email: 'jane@example.com' }]);

    await db.public.User.where({ email: 'jane@example.com' }).update({ emailVerified: true });
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'JANE@example.COM', password: newUser.password })
      .expect(200);
  });
});
