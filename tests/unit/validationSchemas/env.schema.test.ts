import { describe, expect, it } from 'vitest';
import { envSchema } from '#validationSchemas/env.schema.js';

const base = {
  APP_PORT: '5999',
  APP_ENV: 'test',
  APP_URL: 'http://localhost:5999',
  FRONTEND_URL: 'http://localhost:3000',
  ALLOWED_ORIGINS: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://u:p@127.0.0.1:1/db',
  EMAIL_HOST: '127.0.0.1',
  EMAIL_PORT: '587',
  EMAIL_FROM: 'Test <test@example.com>',
  EMAIL_USER: 'test@example.com',
  EMAIL_PASSWORD: 'secret',
  CACHE_URL: 'redis://127.0.0.1:1',
  CACHE_PASS: 'secret',
  QUEUE_HOST: '127.0.0.1',
  QUEUE_PORT: '6379',
  QUEUE_PASS: 'secret',
  WORKER_CONCURRENCY: '3',
};

type EnvInput = Partial<Record<keyof typeof base, string | undefined>>;

function parse(overrides: EnvInput): ReturnType<typeof envSchema.safeParse> {
  return envSchema.safeParse({ ...base, ...overrides });
}

function messages(overrides: EnvInput): string[] {
  const result = parse(overrides);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe('envSchema', () => {
  it('parses a complete env, coercing ports to numbers', () => {
    const env = envSchema.parse(base);
    expect(env).toMatchObject({
      APP_PORT: 5999,
      EMAIL_PORT: 587,
      QUEUE_PORT: 6379,
      WORKER_CONCURRENCY: 3,
      ALLOWED_ORIGINS: ['http://localhost:3000'],
    });
  });

  it('defaults APP_PORT to 5000 and WORKER_CONCURRENCY to 5 when absent', () => {
    const env = envSchema.parse({ ...base, APP_PORT: undefined, WORKER_CONCURRENCY: undefined });
    expect(env.APP_PORT).toBe(5000);
    expect(env.WORKER_CONCURRENCY).toBe(5);
  });

  it.each(['development', 'test', 'production'])('accepts APP_ENV=%s', (APP_ENV) => {
    expect(parse({ APP_ENV }).success).toBe(true);
  });

  it.each([undefined, '', 'staging'])('rejects APP_ENV=%j', (APP_ENV) => {
    expect(messages({ APP_ENV })).toEqual([
      'APP_ENV is required and must be development, test or production',
    ]);
  });

  it.each([
    'APP_URL',
    'FRONTEND_URL',
    'DATABASE_URL',
    'EMAIL_HOST',
    'EMAIL_FROM',
    'EMAIL_USER',
    'EMAIL_PASSWORD',
    'CACHE_URL',
    'CACHE_PASS',
    'QUEUE_HOST',
    'QUEUE_PASS',
  ] as const)('requires %s (missing or empty)', (key) => {
    expect(messages({ [key]: undefined })).toEqual([`${key} is required`]);
    expect(messages({ [key]: '' })).toEqual([`${key} is required`]);
  });

  describe.each(['EMAIL_PORT', 'QUEUE_PORT', 'APP_PORT', 'WORKER_CONCURRENCY'] as const)(
    '%s',
    (key) => {
      it('rejects non-numeric values', () => {
        expect(messages({ [key]: 'abc' })).toEqual([`${key} must be a number`]);
      });

      it('rejects non-integers', () => {
        expect(messages({ [key]: '1.5' })).toEqual([`${key} must be an integer`]);
      });

      it.each(['0', '-1', ''])('rejects non-positive %j', (value) => {
        expect(messages({ [key]: value })).toEqual([`${key} is required`]);
      });
    },
  );

  it.each(['EMAIL_PORT', 'QUEUE_PORT'] as const)('rejects a missing %s', (key) => {
    expect(parse({ [key]: undefined }).success).toBe(false);
  });

  describe('ALLOWED_ORIGINS', () => {
    it('splits, trims, drops blanks and normalises to bare origins', () => {
      const env = envSchema.parse({
        ...base,
        ALLOWED_ORIGINS: ' http://localhost:3000/ , https://app.example.com/path?q=1,, ',
      });
      expect(env.ALLOWED_ORIGINS).toEqual(['http://localhost:3000', 'https://app.example.com']);
    });

    it('drops default ports and lowercases the host', () => {
      const env = envSchema.parse({ ...base, ALLOWED_ORIGINS: 'https://APP.example.com:443' });
      expect(env.ALLOWED_ORIGINS).toEqual(['https://app.example.com']);
    });

    it.each([undefined, ''])('is required (%j)', (ALLOWED_ORIGINS) => {
      expect(messages({ ALLOWED_ORIGINS })).toEqual(['ALLOWED_ORIGINS is required']);
    });

    it('rejects a list with only separators', () => {
      expect(parse({ ALLOWED_ORIGINS: ' , ,' }).success).toBe(false);
    });

    it('rejects entries that are not URLs', () => {
      expect(messages({ ALLOWED_ORIGINS: 'http://ok.test,not a url' })).toEqual([
        'ALLOWED_ORIGINS must be a comma separated list of http(s) URLs',
      ]);
    });

    // Regression: these all have origin "null", which would let sandboxed iframes / file:// pages
    // make credentialed CORS requests.
    it.each(['localhost:3000', 'file:///etc/passwd', 'javascript:alert(1)', 'ftp://files.test'])(
      'rejects the non-http(s) origin %s',
      (origin) => {
        expect(messages({ ALLOWED_ORIGINS: origin })).toEqual([
          'ALLOWED_ORIGINS must be a comma separated list of http(s) URLs',
        ]);
      },
    );
  });
});
