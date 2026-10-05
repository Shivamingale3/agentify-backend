import { registerShutdown } from '#lib/shutdown.js';
import { env } from '#providers/env.provider.js';
import mailService from '#services/mail.service.js';
import queueService, { QUEUES } from '#services/queue.service.js';
import type { JobPayload } from '#types/jobs.types.js';
import { logger } from '#utils/logger.js';
import { dispatchJob } from '#workers/index.workers.js';

/**
 * Worker process entry point. Runs separately from the API (server.ts);
 * start as many copies as you need — they all consume the same jobs queue.
 */
async function startWorker(): Promise<void> {
  try {
    // Test Queue
    await queueService.checkConnection();

    // Test Mail Service (email jobs need it)
    await mailService.checkConnection();

    queueService.onProcess<JobPayload>(QUEUES.JOBS, dispatchJob, {
      concurrency: env.WORKER_CONCURRENCY,
    });
    logger.info(
      `✅ Worker Initialization Success (pid ${process.pid}, concurrency ${env.WORKER_CONCURRENCY})`,
    );

    registerShutdown(async () => {
      // Order matters: workers finish their current jobs (which may send mail) before mail closes.
      await queueService.shutdown();
      mailService.shutdown();
    });
  } catch (error) {
    logger.error('Failed to start the worker:', error);
    process.exit(1);
  }
}

startWorker().catch((error: unknown) => {
  logger.error('Unexpected error during worker startup:', error);
  process.exit(1);
});
