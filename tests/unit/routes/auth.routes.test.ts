import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { errorHandler } from '#middlewares/error.middleware.js';
import authRouter from '#routes/auth.routes.js';
import authService from '#services/auth.service.js';

vi.mock('#services/auth.service.js', () => ({ default: { register: vi.fn() } }));
vi.mock('#utils/logger.js', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));

const app = express().use(express.json()).use('/auth', authRouter).use(errorHandler);
const valid = { email: 'a@example.com', password: 'Passw0rd!' };

describe('authRouter POST /register', () => {
  it('validates the body then calls the controller', async () => {
    vi.mocked(authService.register).mockResolvedValue(undefined);

    const res = await request(app)
      .post('/auth/register')
      .send({ ...valid, unknownField: 'dropped' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, message: 'Registered successfully', data: null });
    // Body is the schema-parsed value: unknown keys stripped.
    expect(authService.register).toHaveBeenCalledWith(valid);
  });

  it('rejects an invalid body with 400 before reaching the service', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ ...valid, email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: 'Invalid email address' });
    expect(authService.register).not.toHaveBeenCalled();
  });

  it('passes service errors to the error middleware', async () => {
    vi.mocked(authService.register).mockRejectedValue(new Error('boom'));

    const res = await request(app).post('/auth/register').send(valid);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, message: 'Internal Server Error' });
  });

  it('does not mount GET /register', async () => {
    const res = await request(app).get('/auth/register');
    expect(res.status).toBe(404);
  });
});
