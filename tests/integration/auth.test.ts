import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '#app.js';
import { db } from '#providers/db.provider.js';
import authService from '#services/auth.service.js';

// Integration test: real Postgres + Redis (Testcontainers), real HTTP stack via supertest.
// Tables and Redis are wiped before each test (see setup.ts), so tests can't see each other's data.

const newUser = { email: 'jane@example.com', password: 'Passw0rd!', firstName: 'Jane' };

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
