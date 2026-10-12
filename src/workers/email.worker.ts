import mailService from '#services/mail.service.js';
import type { JobWorker } from '#types/jobs.types.js';
import { logger } from '#utils/logger.js';

/** Sends an email. Throwing makes the queue retry with backoff. */
export const emailWorker: JobWorker<'email'> = async (job) => {
  try {
    await mailService.sendMail(job.data);
    logger.info('Email job %s sent', job.id);
  } catch (error) {
    // Job id, not the address: BullMQ keeps failed jobs (with the recipient) for 7 days.
    logger.error('Email job %s failed', job.id, { error });
    throw error;
  }
};
