import { describe, expect, it, vi } from 'vitest';
import temporaryTaskService from '#services/temporaryTask.service.js';
import { cleanupTemporaryTasksWorker } from '#workers/cleanupTemporaryTasks.worker.js';

vi.mock('#services/temporaryTask.service.js', () => ({ default: { deleteExpired: vi.fn() } }));

const job = { id: 'c1', name: 'cleanupTemporaryTasks', attemptsMade: 0, data: {} };

describe('cleanupTemporaryTasksWorker', () => {
  it('deletes expired temporary tasks', async () => {
    vi.mocked(temporaryTaskService.deleteExpired).mockResolvedValue(3);

    await cleanupTemporaryTasksWorker(job);

    expect(temporaryTaskService.deleteExpired).toHaveBeenCalledOnce();
  });

  it('rethrows failures so the queue retries', async () => {
    vi.mocked(temporaryTaskService.deleteExpired).mockRejectedValue(new Error('db down'));

    await expect(cleanupTemporaryTasksWorker(job)).rejects.toThrow('db down');
  });
});
