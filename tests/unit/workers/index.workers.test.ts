import { describe, expect, it, vi } from 'vitest';
import type { QueueJob } from '#interfaces/queue.interface.js';
import type { JobPayload } from '#types/jobs.types.js';
import { buildWorker } from '#workers/build.worker.js';
import { cleanupTemporaryTasksWorker } from '#workers/cleanupTemporaryTasks.worker.js';
import { emailWorker } from '#workers/email.worker.js';
import { dispatchJob } from '#workers/index.workers.js';

vi.mock('#workers/email.worker.js', () => ({ emailWorker: vi.fn() }));
vi.mock('#workers/build.worker.js', () => ({ buildWorker: vi.fn() }));
vi.mock('#workers/cleanupTemporaryTasks.worker.js', () => ({
  cleanupTemporaryTasksWorker: vi.fn(),
}));

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

  it('routes cleanup jobs to the cleanup worker', async () => {
    await dispatchJob(job({ type: 'cleanupTemporaryTasks', data: {} }));

    expect(cleanupTemporaryTasksWorker).toHaveBeenCalledWith(expect.objectContaining({ data: {} }));
    expect(emailWorker).not.toHaveBeenCalled();
  });

  it('rejects a job type with no worker', async () => {
    // Simulates a job enqueued by a newer deploy with a type this build does not know.
    const unknown = { id: 'j1', name: 'sms', attemptsMade: 0, data: { type: 'sms', data: {} } };

    await expect(dispatchJob(unknown)).rejects.toThrow('Invalid payload for job j1');
  });

  // Regression: job.data from Redis used to reach workers unvalidated.
  it.each([
    ['email without a recipient', { type: 'email', data: { subject: 'S', text: 'T' } }],
    ['email with a bad address', { type: 'email', data: { ...email, to: 'nope' } }],
    ['build without a prompt', { type: 'build', data: { projectId: 'p1' } }],
    ['a non-object payload', 'garbage'],
  ])('rejects %s without calling any worker', async (_label, data) => {
    await expect(dispatchJob({ id: 'j1', name: 'x', attemptsMade: 0, data })).rejects.toThrow(
      'Invalid payload for job j1',
    );
    expect(emailWorker).not.toHaveBeenCalled();
    expect(buildWorker).not.toHaveBeenCalled();
  });

  it('propagates worker failures', async () => {
    vi.mocked(emailWorker).mockRejectedValue(new Error('smtp down'));

    await expect(dispatchJob(job({ type: 'email', data: email }))).rejects.toThrow('smtp down');
  });
});
