import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { app } from '#app.js';
import { db } from '#providers/db.provider.js';
import queueService, { QUEUES } from '#services/queue.service.js';
import type { JobPayload } from '#types/jobs.types.js';
import { dispatchJob } from '#workers/index.workers.js';

// No SMTP: the real mail service and email worker run, only the transport is faked.
const sendMail = vi.hoisted(() => vi.fn());
vi.mock('#providers/mail.provider.js', () => ({
  default: { sendMail, testConnection: vi.fn(), close: vi.fn() },
}));

// Kept to a single test: the worker registered via onProcess lives until setup.ts's
// queueService.shutdown() closes it, so a second test would share it.
describe('queueService.onProcess (real Redis)', () => {
  it('processes the verification email enqueued by register end-to-end', async () => {
    sendMail.mockResolvedValue(undefined);
    queueService.onProcess<JobPayload>(QUEUES.JOBS, dispatchJob, { concurrency: 1 });

    await request(app)
      .post('/api/auth/register')
      .send({ email: 'jane@example.com', password: 'Passw0rd!' })
      .expect(201);

    await vi.waitFor(
      () => {
        expect(sendMail).toHaveBeenCalledTimes(1);
      },
      { timeout: 10_000, interval: 50 },
    );
    const task = await db.public.TemporaryTasks.first();
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
        subject: 'Email Verification',
        html: expect.stringContaining(`verify-email?token=${task?.token ?? 'missing'}`),
      }),
    );
  });
});
