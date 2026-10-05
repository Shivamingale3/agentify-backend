import mailService from '#services/mail.service.js';
import type { JobWorker } from '#types/jobs.types.js';

/** Sends an email. Throwing makes the queue retry with backoff. */
export const emailWorker: JobWorker<'email'> = async (job) => {
  await mailService.sendMail(job.data);
};
