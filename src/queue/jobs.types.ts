import type { MailMessage } from '@/mail/mail.service.js';

/** The one BullMQ queue: every job type goes through it and the worker routes by `type`. */
export const JOBS_QUEUE = 'jobs';

export interface BuildJobData {
  projectId: string;
  prompt: string;
}

/**
 * Every job on the jobs queue. `type` decides which handler runs it.
 * To add a job: add a member here, then a handler in the jobs processor (it fails to compile until you do).
 */
export type JobPayload =
  | { type: 'email'; data: MailMessage }
  | { type: 'build'; data: BuildJobData }
  | { type: 'cleanupChores'; data: Record<string, never> };

export type JobType = JobPayload['type'];
