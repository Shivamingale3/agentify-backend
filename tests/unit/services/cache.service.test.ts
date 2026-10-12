import { describe, expect, it, vi } from 'vitest';
import z from 'zod';
import cacheProvider from '#providers/redis-cache.provider.js';
import cacheService from '#services/cache.service.js';

vi.mock('#providers/redis-cache.provider.js', () => ({
  default: {
    checkConnnection: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    flush: vi.fn(),
    close: vi.fn(),
  },
}));

const schema = z.object({ id: z.string() });

describe('CacheService.get', () => {
  it('returns null on a cache miss', async () => {
    vi.mocked(cacheProvider.get).mockResolvedValue(null);

    await expect(cacheService.get('k')).resolves.toBeNull();
    expect(cacheProvider.get).toHaveBeenCalledWith('k');
  });

  it('parses JSON when no schema is given', async () => {
    vi.mocked(cacheProvider.get).mockResolvedValue('{"a":1}');

    await expect(cacheService.get('k')).resolves.toEqual({ a: 1 });
  });

  it('returns the validated value when it matches the schema', async () => {
    vi.mocked(cacheProvider.get).mockResolvedValue('{"id":"x"}');

    await expect(cacheService.get('k', schema)).resolves.toEqual({ id: 'x' });
  });

  it('returns null when the value fails schema validation', async () => {
    vi.mocked(cacheProvider.get).mockResolvedValue('{"id":1}');

    await expect(cacheService.get('k', schema)).resolves.toBeNull();
  });

  it('returns null when the value is not JSON (with and without a schema)', async () => {
    vi.mocked(cacheProvider.get).mockResolvedValue('not json');

    await expect(cacheService.get('k')).resolves.toBeNull();
    await expect(cacheService.get('k', schema)).resolves.toBeNull();
  });

  it('swallows provider errors as a miss', async () => {
    vi.mocked(cacheProvider.get).mockRejectedValue(new Error('down'));

    await expect(cacheService.get('k')).resolves.toBeNull();
  });
});

describe('CacheService.set', () => {
  it('serializes the value and passes the ttl through', async () => {
    await cacheService.set('k', { a: 1 }, 500);

    expect(cacheProvider.set).toHaveBeenCalledWith('k', '{"a":1}', 500);
  });

  it('passes an undefined ttl when none is given', async () => {
    await cacheService.set('k', 'v');

    expect(cacheProvider.set).toHaveBeenCalledWith('k', '"v"', undefined);
  });

  it('swallows provider errors', async () => {
    vi.mocked(cacheProvider.set).mockRejectedValue(new Error('down'));

    await expect(cacheService.set('k', 1)).resolves.toBeUndefined();
  });

  it('swallows serialization errors without calling the provider', async () => {
    await expect(cacheService.set('k', { n: 1n })).resolves.toBeUndefined();
    expect(cacheProvider.set).not.toHaveBeenCalled();
  });
});

describe('CacheService delegation', () => {
  it('checkConnection, del, flush and shutdown call the provider', async () => {
    await cacheService.checkConnection();
    await cacheService.del('k');
    await cacheService.flush();
    await cacheService.shutdown();

    expect(cacheProvider.checkConnnection).toHaveBeenCalledOnce();
    expect(cacheProvider.del).toHaveBeenCalledWith('k');
    expect(cacheProvider.flush).toHaveBeenCalledOnce();
    expect(cacheProvider.close).toHaveBeenCalledOnce();
  });

  it('propagates a failed connection check', async () => {
    vi.mocked(cacheProvider.checkConnnection).mockRejectedValue(new Error('refused'));

    await expect(cacheService.checkConnection()).rejects.toThrow('refused');
  });
});
