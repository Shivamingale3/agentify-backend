import type { MailMessage } from '#interfaces/mail.interfaces.js';
import type { QueueJob } from '#interfaces/queue.interface.js';

export interface BuildJobData {
  projectId: string;
  prompt: string;
}

/**
 * Every job on the shared jobs queue. `type` decides which worker runs it.
 * To add a job: add a member here, then a worker in `workers/index.workers.ts`
 * (the compiler errors until you do).
 */
export type JobPayload =
  | { type: 'email'; data: MailMessage }
  | { type: 'build'; data: BuildJobData }
  | { type: 'cleanupTemporaryTasks'; data: Record<string, never> };

export type JobType = JobPayload['type'];

export type JobData<K extends JobType> = Extract<JobPayload, { type: K }>['data'];

/** A worker for one job type. Receives the job with its type-specific `data`. */
export type JobWorker<K extends JobType> = (job: QueueJob<JobData<K>>) => Promise<void>;
