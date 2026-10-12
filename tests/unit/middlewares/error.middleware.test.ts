import express, { type Request, type Response } from 'express';
import { ErrorReply } from 'redis';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { HttpException } from '#exceptions/http.exception.js';
import { errorHandler } from '#middlewares/error.middleware.js';
import { logger } from '#utils/logger.js';

vi.mock('#utils/logger.js', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));

const UNAVAILABLE = 'Service temporarily unavailable, please try again';

/** App whose only route throws `err`, with the error middleware mounted. */
function appThrowing(err: unknown): express.Express {
  const app = express();
  app.get('/boom', () => {
    throw err;
  });
  app.use(errorHandler);
  return app;
}

async function resolve(err: unknown): Promise<{ status: number; body: unknown }> {
  const res = await request(appThrowing(err)).get('/boom');
  return { status: res.status, body: res.body as unknown };
}

function sqlQueryError(sqlState: string | undefined): Error {
  return Object.assign(new Error('query failed'), { kind: 'sql_query', sqlState });
}

describe('errorHandler', () => {
  beforeEach(() => {
    vi.mocked(logger.warn).mockReturnValue(logger);
    vi.mocked(logger.error).mockReturnValue(logger);
  });

  it('uses status and message of an HttpException and logs 4xx as warn', async () => {
    const res = await resolve(new HttpException(418, 'teapot'));
    expect(res).toEqual({ status: 418, body: { success: false, message: 'teapot' } });
    expect(logger.warn).toHaveBeenCalledWith('[http] GET /boom → 418: teapot');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs a 5xx HttpException as error with the stack', async () => {
    const err = new HttpException(503, 'down');
    const res = await resolve(err);
    expect(res).toEqual({ status: 503, body: { success: false, message: 'down' } });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[http] GET /boom → 503'));
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(err.stack ?? 'missing stack'),
    );
  });

  it('maps a ZodError to 400 with the first issue message', async () => {
    const parsed = z.object({ a: z.string('a must be text') }).safeParse({ a: 1 });
    const res = await resolve(parsed.error);
    expect(res).toEqual({ status: 400, body: { success: false, message: 'a must be text' } });
  });

  it('falls back to "Validation failed" for a ZodError without issues', async () => {
    const res = await resolve(new z.ZodError([]));
    expect(res).toEqual({ status: 400, body: { success: false, message: 'Validation failed' } });
  });

  describe('exposed express errors', () => {
    it('maps malformed JSON to 400', async () => {
      const app = express();
      app.use(express.json());
      app.post('/', (_req, res) => res.sendStatus(204));
      app.use(errorHandler);

      const res = await request(app)
        .post('/')
        .set('Content-Type', 'application/json')
        .send('{"bad"');
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, message: 'Malformed request body' });
    });

    it('maps a too-large body to 413', async () => {
      const app = express();
      app.use(express.json({ limit: '10b' }));
      app.post('/', (_req, res) => res.sendStatus(204));
      app.use(errorHandler);

      const res = await request(app)
        .post('/')
        .send({ payload: 'x'.repeat(100) });
      expect(res.status).toBe(413);
      expect(res.body).toEqual({ success: false, message: 'Request body too large' });
    });

    it('does not trust a 4xx status without expose: true', async () => {
      const res = await resolve(Object.assign(new Error('secret detail'), { status: 400 }));
      expect(res).toEqual({
        status: 500,
        body: { success: false, message: 'Internal Server Error' },
      });
    });
  });

  describe('SQL query errors', () => {
    it.each([
      ['23505', 409, 'Resource already exists'],
      ['23503', 409, 'Related resource missing or still in use'],
      ['23502', 400, 'Missing required field'],
      ['23514', 400, 'Invalid value'],
      ['22001', 400, 'Invalid input'],
      ['22P02', 400, 'Invalid input'],
      ['08006', 503, UNAVAILABLE],
      ['53300', 503, UNAVAILABLE],
      ['57P01', 503, UNAVAILABLE],
      ['42P01', 500, 'Internal Server Error'],
      [undefined, 500, 'Internal Server Error'],
    ])('maps SQLSTATE %s to %i', async (sqlState, status, message) => {
      const res = await resolve(sqlQueryError(sqlState));
      expect(res).toEqual({ status, body: { success: false, message } });
    });

    it('tags the log with the database source', async () => {
      await resolve(sqlQueryError('23505'));
      expect(logger.warn).toHaveBeenCalledWith(
        '[database] GET /boom → 409: Resource already exists',
      );
    });
  });

  it('maps a SQL connection error to 503', async () => {
    const err = Object.assign(new Error('conn lost'), { kind: 'sql_connection' });
    const res = await resolve(err);
    expect(res).toEqual({ status: 503, body: { success: false, message: UNAVAILABLE } });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[database]'));
  });

  describe('Prisma structured errors', () => {
    it('maps DRIVER.* to 503', async () => {
      const err = Object.assign(new Error('driver'), { code: 'DRIVER.CONNECTION_FAILED' });
      const res = await resolve(err);
      expect(res).toEqual({ status: 503, body: { success: false, message: UNAVAILABLE } });
    });

    it.each(['ORM.NOT_FOUND', 'RUNTIME.BAD_STATE', 'CONTRACT.MISMATCH'])(
      'maps %s to 500',
      async (code) => {
        const res = await resolve(Object.assign(new Error('bug'), { code }));
        expect(res).toEqual({
          status: 500,
          body: { success: false, message: 'Internal Server Error' },
        });
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[database]'));
      },
    );
  });

  describe('Redis errors', () => {
    it('maps a node-redis error to 503', async () => {
      const res = await resolve(new ErrorReply('ERR'));
      expect(res).toEqual({ status: 503, body: { success: false, message: UNAVAILABLE } });
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[redis]'));
    });

    it('maps an ioredis error (by name) to 503', async () => {
      const err = Object.assign(new Error('retries'), { name: 'MaxRetriesPerRequestError' });
      const res = await resolve(err);
      expect(res).toEqual({ status: 503, body: { success: false, message: UNAVAILABLE } });
    });
  });

  it.each(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE'])(
    'maps network error %s to 503',
    async (code) => {
      const res = await resolve(Object.assign(new Error('net'), { code }));
      expect(res).toEqual({ status: 503, body: { success: false, message: UNAVAILABLE } });
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[network]'));
    },
  );

  it('maps an unknown Error to a generic 500 without leaking its message', async () => {
    const res = await resolve(new Error('db password is hunter2'));
    expect(res).toEqual({
      status: 500,
      body: { success: false, message: 'Internal Server Error' },
    });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[unknown] GET /boom → 500'));
  });

  it('handles a thrown non-Error value', async () => {
    const res = await resolve('plain string');
    expect(res).toEqual({
      status: 500,
      body: { success: false, message: 'Internal Server Error' },
    });
    expect(logger.error).toHaveBeenCalledWith('[unknown] GET /boom → 500: plain string');
  });

  it('logs the message when an Error has no stack', async () => {
    const err = new Error('no stack');
    delete err.stack;
    await resolve(err);
    expect(logger.error).toHaveBeenCalledWith('[unknown] GET /boom → 500: no stack');
  });

  it('delegates to next when headers were already sent', () => {
    const err = new HttpException(400, 'late');
    const status = vi.fn();
    const json = vi.fn();
    const next = vi.fn<(err?: unknown) => void>();
    const res = { headersSent: true, status, json } as unknown as Response;

    errorHandler(err, {} as Request, res, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(status).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
