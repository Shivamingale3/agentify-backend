import { describe, expect, it, vi } from 'vitest';
import bullmqProvider from '#providers/bullmq.provider.js';
import queueService, { QUEUES } from '#services/queue.service.js';

vi.mock('#providers/bullmq.provider.js', () => ({
  default: { connect: vi.fn(), addJob: vi.fn(), registerWorker: vi.fn(), close: vi.fn() },
}));

describe('QueueService', () => {
  it('exposes the shared jobs queue name', () => {
    expect(QUEUES.JOBS).toBe('jobs');
  });

  it('checkConnection connects the provider and propagates failures', async () => {
    await queueService.checkConnection();
    expect(bullmqProvider.connect).toHaveBeenCalledOnce();

    vi.mocked(bullmqProvider.connect).mockRejectedValue(new Error('refused'));
    await expect(queueService.checkConnection()).rejects.toThrow('refused');
  });

  it('enqueue adds the job and returns its id', async () => {
    vi.mocked(bullmqProvider.addJob).mockResolvedValue('42');

    await expect(queueService.enqueue(QUEUES.JOBS, 'name', { a: 1 }, { delay: 5 })).resolves.toBe(
      '42',
    );
    expect(bullmqProvider.addJob).toHaveBeenCalledWith('jobs', 'name', { a: 1 }, { delay: 5 });
  });

  it('enqueueJob puts the whole payload on the jobs queue, named by its type', async () => {
    vi.mocked(bullmqProvider.addJob).mockResolvedValue('7');
    const payload = { type: 'build', data: { projectId: 'p1', prompt: 'go' } } as const;

    await expect(queueService.enqueueJob(payload, { priority: 1 })).resolves.toBe('7');
    expect(bullmqProvider.addJob).toHaveBeenCalledWith('jobs', 'build', payload, { priority: 1 });
  });

  it('propagates enqueue failures', async () => {
    vi.mocked(bullmqProvider.addJob).mockRejectedValue(new Error('redis down'));

    await expect(
      queueService.enqueueJob({ type: 'build', data: { projectId: 'p', prompt: 'x' } }),
    ).rejects.toThrow('redis down');
  });

  it('onProcess registers a worker with the handler and options', () => {
    const handler = vi.fn(() => Promise.resolve());

    queueService.onProcess(QUEUES.JOBS, handler, { concurrency: 2 });

    expect(bullmqProvider.registerWorker).toHaveBeenCalledWith('jobs', handler, {
      concurrency: 2,
    });
  });

  it('shutdown closes the provider', async () => {
    await queueService.shutdown();

    expect(bullmqProvider.close).toHaveBeenCalledOnce();
  });
});
