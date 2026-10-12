import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { notFoundHandler } from '#middlewares/notFound.middleware.js';

describe('notFoundHandler', () => {
  it('responds 404 with the standard error shape for any method/path', async () => {
    const app = express();
    app.use(notFoundHandler);

    for (const res of [await request(app).get('/nope'), await request(app).post('/a/b')]) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ success: false, message: 'Route not found' });
    }
  });
});
