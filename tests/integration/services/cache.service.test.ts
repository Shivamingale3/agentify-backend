import { setTimeout as sleep } from 'node:timers/promises';
import { createClient } from 'redis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import z from 'zod';
import { env } from '#providers/env.provider.js';
import cacheService from '#services/cache.service.js';

// A separate raw client to inspect what the service actually wrote (TTL, raw values).
const raw = createClient({ url: env.CACHE_URL, password: env.CACHE_PASS });

beforeAll(async () => {
  await raw.connect();
});

afterAll(async () => {
  await raw.close();
});

const schema = z.object({ id: z.string(), count: z.number() });

describe('cacheService (real Redis)', () => {
  it('round-trips a JSON value', async () => {
    await cacheService.set('k', { id: 'a', count: 1 });

    expect(await cacheService.get('k')).toEqual({ id: 'a', count: 1 });
    expect(await cacheService.get('k', schema)).toEqual({ id: 'a', count: 1 });
  });

  it('returns null for a missing key', async () => {
    expect(await cacheService.get('missing')).toBeNull();
  });

  it('stores a TTL in milliseconds and expires the key', async () => {
    await cacheService.set('short', { id: 'a', count: 1 }, 200);

    const pttl = await raw.pTTL('short');
    expect(pttl).toBeGreaterThan(0);
    expect(pttl).toBeLessThanOrEqual(200);

    await sleep(300);
    expect(await cacheService.get('short')).toBeNull();
  });

  it('stores without expiry when no TTL is given', async () => {
    await cacheService.set('forever', 1);

    expect(await raw.pTTL('forever')).toBe(-1);
  });

  it('returns null when cached data fails schema validation', async () => {
    await cacheService.set('bad', { id: 42 });

    expect(await cacheService.get('bad', schema)).toBeNull();
  });

  it('returns null for a non-JSON cached value', async () => {
    await raw.set('garbage', 'not json{');

    expect(await cacheService.get('garbage', schema)).toBeNull();
    expect(await cacheService.get('garbage')).toBeNull();
  });

  it('del removes a key', async () => {
    await cacheService.set('k', 1);

    await cacheService.del('k');

    expect(await cacheService.get('k')).toBeNull();
  });

  it('flush removes every key', async () => {
    await cacheService.set('a', 1);
    await cacheService.set('b', 2);

    await cacheService.flush();

    expect(await raw.dbSize()).toBe(0);
  });
});
