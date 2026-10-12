import z from 'zod';
import type { QueueJob } from '#interfaces/queue.interface.js';
import type { JobType, JobWorker } from '#types/jobs.types.js';
import { jobPayloadSchema } from '#validationSchemas/jobs/jobPayload.schema.js';
import { buildWorker } from '#workers/build.worker.js';
import { emailWorker } from '#workers/email.worker.js';

/** One worker per job type. Adding a type to JobPayload without a worker here fails to compile. */
const workers: { [K in JobType]: JobWorker<K> } = {
  email: emailWorker,
  build: buildWorker,
};

/**
 * Handler for the shared jobs queue: validates the payload, then routes it to the worker for its `type`.
 * Job data comes from Redis (possibly enqueued by another deploy), so it is untrusted until parsed.
 */
export async function dispatchJob(job: QueueJob<unknown>): Promise<void> {
  const parsed = jobPayloadSchema.safeParse(job.data);
  if (!parsed.success) {
    throw new Error(`Invalid payload for job ${job.id}: ${z.prettifyError(parsed.error)}`);
  }
  const { type, data } = parsed.data;
  // Validated above; the cast only bridges TypeScript's lack of correlated-union narrowing.
  const worker = workers[type] as JobWorker<JobType>;
  await worker({ ...job, data });
}
