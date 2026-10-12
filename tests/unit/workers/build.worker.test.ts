import { setTimeout as sleep } from 'node:timers/promises';
import { describe, expect, it, vi } from 'vitest';
import { buildWorker } from '#workers/build.worker.js';

vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn(() => Promise.resolve()) }));

describe('buildWorker', () => {
  it('runs the placeholder agent step and resolves', async () => {
    await expect(
      buildWorker({
        id: '1',
        name: 'build',
        attemptsMade: 0,
        data: { projectId: 'p', prompt: 'x' },
      }),
    ).resolves.toBeUndefined();
    expect(sleep).toHaveBeenCalledWith(1000);
  });
});
