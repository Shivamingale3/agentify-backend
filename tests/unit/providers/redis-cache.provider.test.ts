import { beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => {
  const client = {
    on: vi.fn((_event: string, _listener: (error: Error) => void) => undefined),
    connect: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    flushAll: vi.fn(),
    close: vi.fn(),
  };
  return { client, createClient: vi.fn(() => client) };
});

vi.mock('redis', () => ({ createClient: fake.createClient }));
vi.mock('#providers/env.provider.js', () => ({
  env: { APP_ENV: 'test', CACHE_URL: 'redis://cache.test:6379', CACHE_PASS: 'cache-pass' },
}));

// The provider is a singleton built at import time, so re-import it fresh for every test.
async function load() {
  vi.resetModules();
  const { default: provider } = await import('#providers/redis-cache.provider.js');
  return provider;
}

let provider: Awaited<ReturnType<typeof load>>;

beforeEach(async () => {
  provider = await load();
});

describe('RedisCacheProvider construction', () => {
  it('creates the client from env with the offline queue disabled', () => {
    expect(fake.createClient).toHaveBeenCalledExactlyOnceWith({
      url: 'redis://cache.test:6379',
      password: 'cache-pass',
      disableOfflineQueue: true,
    });
  });

  it('registers an error listener that does not throw', () => {
    const [event, listener] = fake.client.on.mock.calls[0] ?? [];
    expect(event).toBe('error');
    expect(listener).toBeTypeOf('function');
    expect(() => {
      listener?.(new Error('ECONNRESET'));
    }).not.toThrow();
  });
});

describe('RedisCacheProvider.checkConnection', () => {
  it('connects the client', async () => {
    await provider.checkConnection();

    expect(fake.client.connect).toHaveBeenCalledOnce();
  });

  it('rethrows connection failures', async () => {
    const error = new Error('refused');
    fake.client.connect.mockRejectedValue(error);

    await expect(provider.checkConnection()).rejects.toBe(error);
  });
});

describe('RedisCacheProvider commands', () => {
  it('get returns the stored value', async () => {
    fake.client.get.mockResolvedValue('v');

    await expect(provider.get('k')).resolves.toBe('v');
    expect(fake.client.get).toHaveBeenCalledWith('k');
  });

  it('get swallows errors as a miss', async () => {
    fake.client.get.mockRejectedValue(new Error('offline'));

    await expect(provider.get('k')).resolves.toBeNull();
  });

  it('set with a ttl sets a PX expiration', async () => {
    await provider.set('k', 'v', 1500);

    expect(fake.client.set).toHaveBeenCalledWith('k', 'v', {
      expiration: { type: 'PX', value: 1500 },
    });
  });

  it('set without a ttl stores without expiration', async () => {
    await provider.set('k', 'v');

    expect(fake.client.set).toHaveBeenCalledWith('k', 'v');
  });

  it('set, del and flush swallow errors', async () => {
    fake.client.set.mockRejectedValue(new Error('offline'));
    fake.client.del.mockRejectedValue(new Error('offline'));
    fake.client.flushAll.mockRejectedValue(new Error('offline'));

    await expect(provider.set('k', 'v', 10)).resolves.toBeUndefined();
    await expect(provider.del('k')).resolves.toBeUndefined();
    await expect(provider.flush()).resolves.toBeUndefined();
  });

  it('del and flush call the client', async () => {
    await provider.del('k');
    await provider.flush();

    expect(fake.client.del).toHaveBeenCalledWith('k');
    expect(fake.client.flushAll).toHaveBeenCalledOnce();
  });

  it('close closes the client gracefully', async () => {
    await provider.close();

    expect(fake.client.close).toHaveBeenCalledOnce();
  });
});
