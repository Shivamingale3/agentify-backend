import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueueJob } from '#interfaces/queue.interface.js';

type Processor = (job: {
  id?: string;
  name: string;
  data: unknown;
  attemptsMade: number;
}) => Promise<void>;

const fake = vi.hoisted(() => {
  // Shared log so close() ordering across workers, queues and connections can be asserted.
  const closeLog: string[] = [];

  class Emitter {
    listeners: Record<string, (...args: unknown[]) => void> = {};
    on(event: string, listener: (...args: unknown[]) => void) {
      this.listeners[event] = listener;
      return this;
    }
  }

  class FakeRedis extends Emitter {
    static instances: FakeRedis[] = [];
    options: Record<string, unknown>;
    ping = vi.fn(() => Promise.resolve('PONG'));
    quit = vi.fn(() => {
      closeLog.push(`redis:${String(this.options['maxRetriesPerRequest'])}`);
      return Promise.resolve('OK');
    });
    constructor(options: Record<string, unknown>) {
      super();
      this.options = options;
      FakeRedis.instances.push(this);
    }
  }

  class FakeQueue extends Emitter {
    static instances: FakeQueue[] = [];
    name: string;
    opts: Record<string, unknown>;
    add = vi.fn((_name: string, _data: unknown, _opts: unknown) =>
      Promise.resolve<{ id?: string }>({ id: 'job-1' }),
    );
    upsertJobScheduler = vi.fn((_id: string, _repeat: unknown, _template: unknown) =>
      Promise.resolve({}),
    );
    close = vi.fn(() => {
      closeLog.push(`queue:${this.name}`);
      return Promise.resolve();
    });
    constructor(name: string, opts: Record<string, unknown>) {
      super();
      this.name = name;
      this.opts = opts;
      FakeQueue.instances.push(this);
    }
  }

  class FakeWorker extends Emitter {
    static instances: FakeWorker[] = [];
    name: string;
    processor: unknown;
    opts: Record<string, unknown>;
    close = vi.fn(() => {
      closeLog.push(`worker:${this.name}`);
      return Promise.resolve();
    });
    constructor(name: string, processor: unknown, opts: Record<string, unknown>) {
      super();
      this.name = name;
      this.processor = processor;
      this.opts = opts;
      FakeWorker.instances.push(this);
    }
  }

  return { closeLog, FakeRedis, FakeQueue, FakeWorker };
});

vi.mock('ioredis', () => ({ Redis: fake.FakeRedis }));
vi.mock('bullmq', () => ({ Queue: fake.FakeQueue, Worker: fake.FakeWorker }));
vi.mock('#providers/env.provider.js', () => ({
  env: { APP_ENV: 'test', QUEUE_HOST: 'queue.test', QUEUE_PORT: 6380, QUEUE_PASS: 'queue-pass' },
}));

const redisOptions = { host: 'queue.test', port: 6380, password: 'queue-pass' };

async function load() {
  vi.resetModules();
  const { default: provider } = await import('#providers/bullmq.provider.js');
  return provider;
}

let provider: Awaited<ReturnType<typeof load>>;

function only<T>(items: T[], index = 0): T {
  const item = items[index];
  if (item === undefined) throw new Error(`missing item ${String(index)}`);
  return item;
}

function processorOf(worker: InstanceType<typeof fake.FakeWorker>): Processor {
  // The provider passes its processor to the BullMQ Worker constructor; the fake stores it as given.
  return worker.processor as Processor;
}

beforeEach(async () => {
  fake.closeLog.length = 0;
  fake.FakeRedis.instances.length = 0;
  fake.FakeQueue.instances.length = 0;
  fake.FakeWorker.instances.length = 0;
  provider = await load();
});

describe('BullMQProvider construction', () => {
  it('opens only a fail-fast producer connection', () => {
    expect(fake.FakeRedis.instances).toHaveLength(1);
    expect(only(fake.FakeRedis.instances).options).toEqual({
      ...redisOptions,
      maxRetriesPerRequest: 1,
    });
  });

  it('handles producer connection errors without throwing', () => {
    const onError = only(fake.FakeRedis.instances).listeners['error'];
    expect(onError).toBeTypeOf('function');
    expect(() => onError?.(new Error('ECONNREFUSED'))).not.toThrow();
  });
});

describe('BullMQProvider.connect', () => {
  it('pings the producer connection', async () => {
    await provider.connect();

    expect(only(fake.FakeRedis.instances).ping).toHaveBeenCalledOnce();
  });

  it('rethrows ping failures', async () => {
    const error = new Error('refused');
    only(fake.FakeRedis.instances).ping.mockRejectedValue(error);

    await expect(provider.connect()).rejects.toBe(error);
  });
});

describe('BullMQProvider.addJob', () => {
  it('creates a queue on the producer connection that skips waiting for ready', async () => {
    await provider.addJob('jobs', 'email', { a: 1 });

    const queue = only(fake.FakeQueue.instances);
    expect(queue.name).toBe('jobs');
    expect(queue.opts).toEqual({
      connection: only(fake.FakeRedis.instances),
      skipWaitingForReady: true,
    });
    expect(queue.listeners['error']).toBeTypeOf('function');
    expect(() => queue.listeners['error']?.(new Error('x'))).not.toThrow();
  });

  it('reuses the queue per name and creates one per new name', async () => {
    await provider.addJob('jobs', 'a', {});
    await provider.addJob('jobs', 'b', {});
    await provider.addJob('other', 'c', {});

    expect(fake.FakeQueue.instances.map((q) => q.name)).toEqual(['jobs', 'other']);
    expect(only(fake.FakeQueue.instances).add).toHaveBeenCalledTimes(2);
  });

  it('applies default job options, letting callers override them', async () => {
    await provider.addJob('jobs', 'email', { a: 1 }, { attempts: 5, delay: 100 });

    expect(only(fake.FakeQueue.instances).add).toHaveBeenCalledWith(
      'email',
      { a: 1 },
      {
        attempts: 5,
        delay: 100,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { age: 7 * 24 * 60 * 60, count: 1000 },
      },
    );
  });

  it('returns the job id, or an empty string when BullMQ gives none', async () => {
    await expect(provider.addJob('jobs', 'a', {})).resolves.toBe('job-1');

    only(fake.FakeQueue.instances).add.mockResolvedValue({});
    await expect(provider.addJob('jobs', 'a', {})).resolves.toBe('');
  });

  it('propagates add failures', async () => {
    await provider.addJob('jobs', 'a', {});
    only(fake.FakeQueue.instances).add.mockRejectedValue(new Error('redis down'));

    await expect(provider.addJob('jobs', 'a', {})).rejects.toThrow('redis down');
  });
});

describe('BullMQProvider.registerWorker', () => {
  it('lazily opens one blocking worker connection shared by all workers', () => {
    provider.registerWorker(
      'jobs',
      vi.fn(() => Promise.resolve()),
    );
    provider.registerWorker(
      'other',
      vi.fn(() => Promise.resolve()),
    );

    expect(fake.FakeRedis.instances).toHaveLength(2);
    const workerConnection = only(fake.FakeRedis.instances, 1);
    expect(workerConnection.options).toEqual({ ...redisOptions, maxRetriesPerRequest: null });
    expect(fake.FakeWorker.instances.map((w) => w.opts['connection'])).toEqual([
      workerConnection,
      workerConnection,
    ]);
    expect(() => workerConnection.listeners['error']?.(new Error('x'))).not.toThrow();
  });

  it('uses concurrency 5 by default and the given concurrency otherwise', () => {
    provider.registerWorker(
      'jobs',
      vi.fn(() => Promise.resolve()),
    );
    provider.registerWorker(
      'jobs',
      vi.fn(() => Promise.resolve()),
      { concurrency: 2 },
    );

    expect(fake.FakeWorker.instances.map((w) => w.opts['concurrency'])).toEqual([5, 2]);
  });

  it('maps the BullMQ job to a QueueJob for the handler', async () => {
    const handler = vi.fn((_job: QueueJob) => Promise.resolve());
    provider.registerWorker('jobs', handler);
    const process = processorOf(only(fake.FakeWorker.instances));

    await process({ id: '9', name: 'email', data: { a: 1 }, attemptsMade: 2 });
    await process({ name: 'email', data: {}, attemptsMade: 0 });

    expect(handler).toHaveBeenNthCalledWith(1, {
      id: '9',
      name: 'email',
      data: { a: 1 },
      attemptsMade: 2,
    });
    expect(handler).toHaveBeenNthCalledWith(2, {
      id: '',
      name: 'email',
      data: {},
      attemptsMade: 0,
    });
  });

  it('propagates handler failures so BullMQ can retry', async () => {
    provider.registerWorker('jobs', () => Promise.reject(new Error('handler failed')));
    const process = processorOf(only(fake.FakeWorker.instances));

    await expect(process({ id: '1', name: 'a', data: {}, attemptsMade: 0 })).rejects.toThrow(
      'handler failed',
    );
  });

  it('listens for completed, failed and error events without throwing', () => {
    provider.registerWorker(
      'jobs',
      vi.fn(() => Promise.resolve()),
    );
    const { listeners } = only(fake.FakeWorker.instances);

    expect(Object.keys(listeners).sort()).toEqual(['completed', 'error', 'failed']);
    expect(() => {
      listeners['completed']?.({ id: '1', name: 'a' });
      listeners['failed']?.({ id: '1', name: 'a' }, new Error('x'));
      listeners['failed']?.(undefined, new Error('stalled'));
      listeners['error']?.(new Error('x'));
    }).not.toThrow();
  });
});

describe('BullMQProvider.close', () => {
  it('closes workers, then queues, then both connections', async () => {
    provider.registerWorker(
      'jobs',
      vi.fn(() => Promise.resolve()),
    );
    await provider.addJob('jobs', 'a', {});

    await provider.close();

    expect(fake.closeLog).toEqual(['worker:jobs', 'queue:jobs', 'redis:1', 'redis:null']);
  });

  it('quits only the producer when no worker was registered', async () => {
    await provider.close();

    expect(fake.closeLog).toEqual(['redis:1']);
  });
});

describe('BullMQProvider.scheduleJob', () => {
  it('upserts a scheduler on the named queue with the default job options', async () => {
    await provider.scheduleJob('jobs', 'cleanup', 60_000, 'cleanupTemporaryTasks', { a: 1 });

    const queue = only(fake.FakeQueue.instances);
    expect(queue.name).toBe('jobs');
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'cleanup',
      { every: 60_000 },
      {
        name: 'cleanupTemporaryTasks',
        data: { a: 1 },
        opts: expect.objectContaining({ attempts: 3 }),
      },
    );
  });
});
