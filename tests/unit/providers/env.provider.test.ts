import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Never read the developer's real .env file.
const fake = vi.hoisted(() => ({ config: vi.fn() }));
vi.mock('dotenv', () => ({ config: fake.config }));

let stderr: string[];

beforeEach(() => {
  vi.resetModules();
  stderr = [];
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
    stderr.push(String(chunk));
    return true;
  });
  // Throwing stops module evaluation where the real process.exit would, without exiting.
  vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`process.exit(${String(code)})`);
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('env.provider', () => {
  it('loads the repo .env via dotenv', async () => {
    await import('#providers/env.provider.js');

    expect(fake.config).toHaveBeenCalledWith({ path: expect.stringMatching(/[\\/]\.env$/) });
  });

  it('exports the parsed, coerced env when valid', async () => {
    vi.stubEnv('ALLOWED_ORIGINS', 'http://a.test/, https://b.test');

    const { env } = await import('#providers/env.provider.js');

    expect(env.APP_ENV).toBe('test');
    expect(env.QUEUE_PORT).toBe(1);
    expect(env.ALLOWED_ORIGINS).toEqual(['http://a.test', 'https://b.test']);
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('exits with code 1 and reports the problem on an invalid value', async () => {
    vi.stubEnv('APP_ENV', 'staging');

    await expect(import('#providers/env.provider.js')).rejects.toThrow('process.exit(1)');
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(stderr.join('')).toContain('APP_ENV is required');
  });

  it('treats an empty required variable as missing', async () => {
    vi.stubEnv('DATABASE_URL', '');

    await expect(import('#providers/env.provider.js')).rejects.toThrow('process.exit(1)');
    expect(stderr.join('')).toContain('DATABASE_URL is required');
  });

  it('reports only messages, never the offending secret values', async () => {
    vi.stubEnv('EMAIL_PORT', 'not-a-port');
    vi.stubEnv('APP_ENV', 'sekret-value');

    await expect(import('#providers/env.provider.js')).rejects.toThrow('process.exit(1)');
    expect(stderr.join('')).toContain('EMAIL_PORT must be a number');
    expect(stderr.join('')).not.toContain('sekret-value');
  });
});
