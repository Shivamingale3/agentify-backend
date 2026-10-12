import { describe, expect, it, vi } from 'vitest';
import type { QueueJob } from '#interfaces/queue.interface.js';
import type { JobPayload } from '#types/jobs.types.js';
import { buildWorker } from '#workers/build.worker.js';
import { emailWorker } from '#workers/email.worker.js';
import { dispatchJob } from '#workers/index.workers.js';

vi.mock('#workers/email.worker.js', () => ({ emailWorker: vi.fn() }));
vi.mock('#workers/build.worker.js', () => ({ buildWorker: vi.fn() }));

function job(data: JobPayload): QueueJob<JobPayload> {
  return { id: 'j1', name: data.type, attemptsMade: 1, data };
}

const email = { to: 'a@example.com', subject: 'S', text: 'T' };

describe('dispatchJob', () => {
  it('routes email jobs to the email worker with the inner data', async () => {
    await dispatchJob(job({ type: 'email', data: email }));

    expect(emailWorker).toHaveBeenCalledWith({
      id: 'j1',
      name: 'email',
      attemptsMade: 1,
      data: email,
    });
    expect(buildWorker).not.toHaveBeenCalled();
  });

  it('routes build jobs to the build worker', async () => {
    const data = { projectId: 'p1', prompt: 'go' };

    await dispatchJob(job({ type: 'build', data }));

    expect(buildWorker).toHaveBeenCalledWith(expect.objectContaining({ id: 'j1', data }));
    expect(emailWorker).not.toHaveBeenCalled();
  });

  it('throws for a job type with no worker', async () => {
    // Simulates a job enqueued by a newer deploy with a type this build does not know.
    const unknown = { type: 'sms', data: {} } as unknown as JobPayload;

    await expect(dispatchJob(job(unknown))).rejects.toThrow(
      'No worker registered for job type "sms"',
    );
  });

  it('propagates worker failures', async () => {
    vi.mocked(emailWorker).mockRejectedValue(new Error('smtp down'));

    await expect(dispatchJob(job({ type: 'email', data: email }))).rejects.toThrow('smtp down');
  });
});
