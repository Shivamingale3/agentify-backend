import { setTimeout as sleep } from 'node:timers/promises';
import type { JobWorker } from '#types/jobs.types.js';
import { logger } from '#utils/logger.js';

/** Sample build-agent worker. Replace the body with the real agent run. */
export const buildWorker: JobWorker<'build'> = async (job) => {
  const { projectId, prompt } = job.data;
  logger.info(
    `🏗️ Build job ${job.id} for project ${projectId} (attempt ${job.attemptsMade + 1}): ${prompt}`,
  );
  await sleep(1000); // placeholder for the agent run
};
