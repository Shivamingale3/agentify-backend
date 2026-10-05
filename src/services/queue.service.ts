import type {
  MQProvider,
  JobHandler,
  JobOptions,
  WorkerOptions,
} from '#interfaces/queue.interface.js';
import bullmqProvider from '#providers/bullmq.provider.js';
import type { JobPayload } from '#types/jobs.types.js';
import { logger } from '#utils/logger.js';

/**
 * QueueService — the app-level API for queuing work.
 *
 * This layer owns:
 *  - Queue name constants (single source of truth)
 *  - Typed helper methods for enqueuing specific jobs
 *  - Worker registration for processing jobs
 *
 * The MQProvider underneath handles raw I/O and can be swapped
 * (BullMQ → RabbitMQ → SQS) without changing any of this code.
 */

/** Centralised queue names — add new ones here as the app grows. */
export const QUEUES = {
  /** Shared queue for all job types; workers route each job by its `type`. */
  JOBS: 'jobs',
} as const;

/** Only names declared in QUEUES are accepted, so a typo fails to compile. */
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

class QueueService {
  private provider: MQProvider;

  constructor(provider: MQProvider) {
    this.provider = provider;
  }

  /** Verify the queue backend is reachable. */
  async checkConnection(): Promise<void> {
    await this.provider.connect();
  }

  // ─── Generic helpers ───────────────────────────────────────────

  /** Enqueue any job on any queue. */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  async enqueue<T = Record<string, unknown>>(
    queueName: QueueName,
    jobName: string,
    data: T,
    options?: JobOptions,
  ): Promise<string> {
    const jobId = await this.provider.addJob(queueName, jobName, data, options);
    logger.info(`📥 Enqueued job "${jobName}" on "${queueName}" [${jobId}]`);
    return jobId;
  }

  // ─── Typed helpers ─────────────────────────────────────────────

  /** Enqueue a job on the shared jobs queue, e.g. `enqueueJob({ type: 'email', data: {...} })`. */
  async enqueueJob(payload: JobPayload, options?: JobOptions): Promise<string> {
    return this.enqueue(QUEUES.JOBS, payload.type, payload, options);
  }

  /** Register a worker for a queue. Call once at startup. */
  onProcess<T = Record<string, unknown>>(
    queueName: QueueName,
    handler: JobHandler<T>,
    options?: WorkerOptions,
  ): void {
    this.provider.registerWorker<T>(queueName, handler, options);
  }

  /** Graceful shutdown — call on SIGTERM / SIGINT. */
  async shutdown(): Promise<void> {
    await this.provider.close();
  }
}

// Default instance wired to BullMQ.
const queueService = new QueueService(bullmqProvider);
export default queueService;
