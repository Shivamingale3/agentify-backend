/**
 * Queue System Interfaces
 *
 * Provider  → raw queue operations (add job, register worker, connect, close)
 * Service   → typed, app-level methods (e.g. queueEmail, queueNotification)
 *
 * The provider is backend-agnostic — swap BullMQ for RabbitMQ, SQS, etc.
 * without touching the service or any consuming code.
 */

/** Which finished jobs to keep: the newest `count`, and/or those younger than `age` seconds. */
export type KeepJobs = { count: number } | { age: number; count?: number };

/** Options for configuring how a job behaves in the queue. */
export interface JobOptions {
  /** Delay in milliseconds before the job becomes available to workers. */
  delay?: number;
  /** Max number of attempts (including the first). Defaults to 3. */
  attempts?: number;
  /** Wait between retries. Defaults to exponential, starting at 1s. */
  backoff?: { type: 'fixed' | 'exponential'; delay: number };
  /** Lower number = higher priority. */
  priority?: number;
  /** Which completed jobs to keep. `true` removes immediately, number keeps N recent. */
  removeOnComplete?: boolean | number | KeepJobs;
  /** Which failed jobs to keep. `true` removes immediately, number keeps N recent. */
  removeOnFail?: boolean | number | KeepJobs;
}

/** Options for a worker. */
export interface WorkerOptions {
  /** Jobs processed in parallel by this worker. Defaults to 5. */
  concurrency?: number;
}

/** A job as seen by the worker handler. */
export interface QueueJob<T = Record<string, unknown>> {
  /** Unique job ID assigned by the queue backend. */
  id: string;
  /** Job name — used to distinguish different types of work within a queue. */
  name: string;
  /** The payload / data the producer sent. */
  data: T;
  /** Attempts already made before this run (0 on the first run). */
  attemptsMade: number;
}

/** Handler function that workers execute for each job. */
export type JobHandler<T = Record<string, unknown>> = (job: QueueJob<T>) => Promise<void>;

/** Provider contract — raw queue I/O, no business logic. */
export interface MQProvider {
  /** Verify the queue backend is reachable. Throws if it is not. */
  connect(): Promise<void>;

  /**
   * Add a job to a named queue.
   * @returns The job ID assigned by the backend.
   */
  addJob(queueName: string, jobName: string, data: unknown, options?: JobOptions): Promise<string>;

  /**
   * Create or update a repeating job. Idempotent per `schedulerId`, so it is safe to call on
   * every worker start: several worker processes still produce one job per interval.
   */
  scheduleJob(
    queueName: string,
    schedulerId: string,
    everyMs: number,
    jobName: string,
    data: unknown,
  ): Promise<void>;

  /**
   * Register a worker that continuously processes jobs from a named queue.
   * The handler is invoked for every job that arrives.
   */
  registerWorker<T = Record<string, unknown>>(
    queueName: string,
    handler: JobHandler<T>,
    options?: WorkerOptions,
  ): void;

  /** Gracefully shut down all queues and workers. */
  close(): Promise<void>;
}
