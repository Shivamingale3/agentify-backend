import temporaryTaskService from '#services/temporaryTask.service.js';
import type { JobWorker } from '#types/jobs.types.js';
import { logger } from '#utils/logger.js';

/** Scheduled hourly (see worker.ts): removes verification/reset tasks nobody used before they expired. */
export const cleanupTemporaryTasksWorker: JobWorker<'cleanupTemporaryTasks'> = async (job) => {
  const deleted = await temporaryTaskService.deleteExpired();
  logger.info('Job %s removed %d expired temporary tasks', job.id, deleted);
};
