import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { HttpException } from '#exceptions/http.exception.js';
import { validationMiddleware } from '#middlewares/validation.middleware.js';

const schema = z.object({ n: z.coerce.number('n must be a number').int() });

/** App that validates `source` and echoes the validated value. */
function echoApp(source?: 'body' | 'query' | 'params'): express.Express {
  const app = express();
  app.use(express.json());
  const mw = source ? validationMiddleware(schema, source) : validationMiddleware(schema);
  app.all('/echo/:n', mw, (req, res) => {
    res.json({ body: req.body as unknown, query: req.query, params: req.params });
  });
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    res
      .status(err instanceof HttpException ? err.statusCode : 500)
      .json({ message: err instanceof Error ? err.message : 'unknown' });
  });
  return app;
}

describe('validationMiddleware', () => {
  it('validates the body by default and replaces it with parsed data', async () => {
    const res = await request(echoApp()).post('/echo/1').send({ n: '5', extra: true });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ body: { n: 5 } });
  });

  it('replaces req.query with parsed data', async () => {
    const res = await request(echoApp('query')).get('/echo/1?n=7&junk=x');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ query: { n: 7 } });
  });

  it('replaces req.params with parsed data', async () => {
    const res = await request(echoApp('params')).get('/echo/9');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ params: { n: 9 } });
  });

  it.each([
    ['body', (app: express.Express) => request(app).post('/echo/1').send({ n: 'x' })],
    ['query', (app: express.Express) => request(app).get('/echo/1?n=x')],
    ['params', (app: express.Express) => request(app).get('/echo/x')],
  ] as const)('forwards a 400 HttpException for invalid %s', async (source, send) => {
    const res = await send(echoApp(source));
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'n must be a number' });
  });

  it('uses "Validation failed" when a ZodError has no issues', async () => {
    const empty = z.unknown().transform(() => {
      throw new z.ZodError([]);
    });
    const next = vi.fn<(err?: unknown) => void>();
    await validationMiddleware(empty)({ body: {} } as Request, {} as Response, next);

    const [err] = next.mock.calls[0] ?? [];
    expect(err).toBeInstanceOf(HttpException);
    expect(err).toMatchObject({ statusCode: 400, message: 'Validation failed' });
  });

  it('forwards non-Zod errors unchanged', async () => {
    const boom = new Error('boom');
    const failing = z.unknown().transform(() => {
      throw boom;
    });
    const next = vi.fn<(err?: unknown) => void>();
    await validationMiddleware(failing)({ body: {} } as Request, {} as Response, next);

    expect(next).toHaveBeenCalledWith(boom);
  });

  it('supports async schemas', async () => {
    const asyncSchema = z.object({ n: z.number() }).refine(async (v) => Promise.resolve(v.n > 0), {
      message: 'n must be positive',
    });
    const next = vi.fn<(err?: unknown) => void>();
    const req = { body: { n: -1 } } as Request;
    await validationMiddleware(asyncSchema)(req, {} as Response, next);

    expect(next.mock.calls[0]?.[0]).toMatchObject({
      statusCode: 400,
      message: 'n must be positive',
    });
  });
});
