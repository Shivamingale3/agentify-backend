import type { QueueJob } from '#interfaces/queue.interface.js';
import type { JobPayload, JobType, JobWorker } from '#types/jobs.types.js';
import { buildWorker } from '#workers/build.worker.js';
import { emailWorker } from '#workers/email.worker.js';

/** One worker per job type. Adding a type to JobPayload without a worker here fails to compile. */
const workers: { [K in JobType]: JobWorker<K> } = {
  email: emailWorker,
  build: buildWorker,
};

/** Handler for the shared jobs queue: routes each job to the worker for its `type`. */
export async function dispatchJob(job: QueueJob<JobPayload>): Promise<void> {
  const { type, data } = job.data;
  // Indexing by a runtime value: an unknown type (e.g. a job enqueued by a newer deploy) is undefined.
  const worker = workers[type] as JobWorker<JobType> | undefined;
  if (!worker) {
    throw new Error(`No worker registered for job type "${type}"`);
  }
  await worker({ ...job, data });
}
