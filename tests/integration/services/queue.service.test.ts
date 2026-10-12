import { Queue } from 'bullmq';
import { afterAll, describe, expect, it } from 'vitest';
import { env } from '#providers/env.provider.js';
import queueService, { QUEUES } from '#services/queue.service.js';
import type { JobPayload } from '#types/jobs.types.js';

// Inspector queue on its own connection; queueService's own connections are closed by setup.ts.
const inspector = new Queue(QUEUES.JOBS, {
  connection: { host: env.QUEUE_HOST, port: env.QUEUE_PORT, password: env.QUEUE_PASS },
});

afterAll(async () => {
  await inspector.close();
});

const emailJob: JobPayload = {
  type: 'email',
  data: { to: 'jane@example.com', subject: 'Hi', text: 'Hello' },
};

describe('queueService.enqueueJob (real Redis)', () => {
  it('adds a waiting job named after its type, with the payload and default options', async () => {
    const jobId = await queueService.enqueueJob(emailJob);

    const job = await inspector.getJob(jobId);
    expect(job?.name).toBe('email');
    expect(job?.data).toEqual(emailJob);
    expect(job?.opts).toMatchObject({
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 1000 },
    });
    expect(await inspector.getWaitingCount()).toBe(1);
  });

  it('lets caller options override the defaults', async () => {
    const jobId = await queueService.enqueueJob(emailJob, { attempts: 1, delay: 60_000 });

    const job = await inspector.getJob(jobId);
    expect(job?.opts).toMatchObject({ attempts: 1, delay: 60_000 });
    expect(await inspector.getDelayedCount()).toBe(1);
  });

  it('checkConnection succeeds against a reachable Redis', async () => {
    await expect(queueService.checkConnection()).resolves.toBeUndefined();
  });

  it('scheduleJob is idempotent: calling it on every worker start keeps one scheduler', async () => {
    const payload = { type: 'cleanupTemporaryTasks', data: {} } as const;

    await queueService.scheduleJob('cleanup-temporary-tasks', 60_000, payload);
    await queueService.scheduleJob('cleanup-temporary-tasks', 60_000, payload);

    const schedulers = await inspector.getJobSchedulers();
    expect(schedulers).toHaveLength(1);
    expect(schedulers[0]).toMatchObject({ key: 'cleanup-temporary-tasks', every: 60_000 });
  });
});
