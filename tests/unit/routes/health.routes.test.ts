import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import healthRouter from '#routes/health.routes.js';

describe('healthRouter', () => {
  const app = express().use('/health', healthRouter);

  it('GET / reports healthy', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Server is healthy' });
  });

  it('only handles GET', async () => {
    const res = await request(app).post('/health');
    expect(res.status).toBe(404);
  });
});
