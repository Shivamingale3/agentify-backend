import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { router } from '#routes/index.routes.js';
import authService from '#services/auth.service.js';

vi.mock('#services/auth.service.js', () => ({ default: { register: vi.fn() } }));

const app = express().use(express.json()).use(router);

describe('index router', () => {
  it('mounts the health router at /health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Server is healthy' });
  });

  it('mounts the auth router at /auth', async () => {
    vi.mocked(authService.register).mockResolvedValue(undefined);
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'a@example.com', password: 'Passw0rd!' });
    expect(res.status).toBe(201);
    expect(authService.register).toHaveBeenCalledOnce();
  });

  it('does not match unknown paths', async () => {
    const res = await request(app).get('/register');
    expect(res.status).toBe(404);
  });
});
