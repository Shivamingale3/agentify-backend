import { ClientClosedError, ErrorReply, SocketTimeoutError } from 'redis';
import { describe, expect, it } from 'vitest';
import {
  isExposedHttpError,
  isNetworkError,
  isRedisError,
  isSqlConnectionError,
  isSqlQueryError,
  isUniqueViolation,
  PG_UNIQUE_VIOLATION,
} from '#utils/errorGuards.js';

function errorWith(props: Record<string, unknown>, name?: string): Error {
  const error = Object.assign(new Error('boom'), props);
  if (name) error.name = name;
  return error;
}

describe('isSqlQueryError / isSqlConnectionError', () => {
  it('match on the kind discriminator of real Error objects', () => {
    expect(isSqlQueryError(errorWith({ kind: 'sql_query' }))).toBe(true);
    expect(isSqlConnectionError(errorWith({ kind: 'sql_connection' }))).toBe(true);
  });

  it('do not confuse the two kinds', () => {
    expect(isSqlQueryError(errorWith({ kind: 'sql_connection' }))).toBe(false);
    expect(isSqlConnectionError(errorWith({ kind: 'sql_query' }))).toBe(false);
  });

  it.each([null, undefined, 'sql_query', { kind: 'sql_query' }, new Error('plain')])(
    'reject %o',
    (value) => {
      expect(isSqlQueryError(value)).toBe(false);
      expect(isSqlConnectionError(value)).toBe(false);
    },
  );
});

describe('isUniqueViolation', () => {
  it('is true only for a SQL query error with SQLSTATE 23505', () => {
    expect(PG_UNIQUE_VIOLATION).toBe('23505');
    expect(isUniqueViolation(errorWith({ kind: 'sql_query', sqlState: '23505' }))).toBe(true);
  });

  it.each([
    errorWith({ kind: 'sql_query', sqlState: '23503' }),
    errorWith({ kind: 'sql_query', sqlState: undefined }),
    errorWith({ kind: 'sql_connection', sqlState: '23505' }),
    errorWith({ sqlState: '23505' }),
    { kind: 'sql_query', sqlState: '23505' },
  ])('is false for %o', (value) => {
    expect(isUniqueViolation(value)).toBe(false);
  });
});

describe('isRedisError', () => {
  it('recognises node-redis error classes', () => {
    expect(isRedisError(new ErrorReply('ERR'))).toBe(true);
    expect(isRedisError(new ClientClosedError())).toBe(true);
    expect(isRedisError(new SocketTimeoutError(100))).toBe(true);
  });

  it.each([
    'RedisError',
    'ReplyError',
    'ParserError',
    'InterruptError',
    'MaxRetriesPerRequestError',
  ])('recognises ioredis %s by name', (name) => {
    expect(isRedisError(errorWith({}, name))).toBe(true);
  });

  it.each([new Error('x'), new TypeError('x'), { name: 'ReplyError' }, 'ReplyError', null])(
    'rejects %o',
    (value) => {
      expect(isRedisError(value)).toBe(false);
    },
  );
});

describe('isNetworkError', () => {
  it.each(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE'])(
    'recognises %s',
    (code) => {
      expect(isNetworkError(errorWith({ code }))).toBe(true);
    },
  );

  it.each([
    errorWith({ code: 'ENOENT' }),
    errorWith({ code: 111 }),
    new Error('no code'),
    { code: 'ECONNREFUSED' },
    undefined,
  ])('rejects %o', (value) => {
    expect(isNetworkError(value)).toBe(false);
  });
});

describe('isExposedHttpError', () => {
  it.each([400, 413, 499])('accepts exposed status %i', (status) => {
    expect(isExposedHttpError(errorWith({ status, expose: true }))).toBe(true);
  });

  it.each([
    errorWith({ status: 399, expose: true }),
    errorWith({ status: 500, expose: true }),
    errorWith({ status: '400', expose: true }),
    errorWith({ status: 400, expose: false }),
    errorWith({ status: 400, expose: 'true' }),
    errorWith({ status: 400 }),
    { status: 400, expose: true },
  ])('rejects %o', (value) => {
    expect(isExposedHttpError(value)).toBe(false);
  });
});
