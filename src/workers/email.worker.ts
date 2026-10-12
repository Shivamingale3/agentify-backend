import mailService from '#services/mail.service.js';
import type { JobWorker } from '#types/jobs.types.js';
import { logger } from '#utils/logger.js';

/** Sends an email. Throwing makes the queue retry with backoff. */
export const emailWorker: JobWorker<'email'> = async (job) => {
  try {
    await mailService.sendMail(job.data);
    logger.info('Email sent successfully to %s', job.data.to);
  } catch (error) {
    logger.error('Email sending failed for user %s', job.data.to, { error });
    throw error;
  }
};
