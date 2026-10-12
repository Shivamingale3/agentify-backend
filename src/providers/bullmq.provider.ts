import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import type {
  MQProvider,
  JobOptions,
  JobHandler,
  QueueJob,
  WorkerOptions,
} from '#interfaces/queue.interface.js';
import { env } from '#providers/env.provider.js';
import { logger } from '#utils/logger.js';

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { age: 7 * 24 * 60 * 60, count: 1000 },
} as const satisfies JobOptions;

const DEFAULT_CONCURRENCY = 5;

/**
 * BullMQ implementation of MQProvider.
 *
 * Internally manages:
 * - Two Redis connections:
 *   - producer: fails fast (maxRetriesPerRequest: 1) so a Redis outage
 *     surfaces as an error instead of hanging the HTTP request
 *   - worker: maxRetriesPerRequest: null, required by BullMQ for blocking reads.
 *     Created on the first `registerWorker`, so API processes (which only enqueue) never open it.
 * - A map of named Queue instances (lazy-created on first `addJob`)
 * - A list of Worker instances (created via `registerWorker`)
 */
class BullMQProvider implements MQProvider {
  private readonly redisOptions = {
    host: env.QUEUE_HOST,
    port: env.QUEUE_PORT,
    password: env.QUEUE_PASS,
  };
  private producerConnection: Redis;
  private workerConnection: Redis | undefined;
  private queues = new Map<string, Queue>();
  private workers: Worker[] = [];

  constructor() {
    this.producerConnection = new Redis({ ...this.redisOptions, maxRetriesPerRequest: 1 });

    // Without an 'error' listener every reconnect failure is reported as unhandled.
    this.producerConnection.on('error', (error) => {
      logger.error(`❌ Queue producer connection error: ${error.message}`);
    });
  }

  private getWorkerConnection(): Redis {
    if (!this.workerConnection) {
      this.workerConnection = new Redis({ ...this.redisOptions, maxRetriesPerRequest: null });
      this.workerConnection.on('error', (error) => {
        logger.error(`❌ Queue worker connection error: ${error.message}`);
      });
    }
    return this.workerConnection;
  }

  async connect(): Promise<void> {
    try {
      // IORedis connects lazily; ping to verify the queue Redis is reachable.
      await this.producerConnection.ping();
      logger.info('✅ Queue (BullMQ) Connection Successful');
    } catch (error) {
      logger.error(
        `❌ Queue Connection Failed : ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Get or create a Queue instance for the given name.
   * Queues are cached so the same Redis connection is reused.
   */
  private getQueue(queueName: string): Queue {
    let queue = this.queues.get(queueName);
    if (!queue) {
      // skipWaitingForReady: a queue first used during a Redis outage would otherwise
      // wait for 'ready' forever instead of failing via maxRetriesPerRequest.
      queue = new Queue(queueName, {
        connection: this.producerConnection,
        skipWaitingForReady: true,
      });
      queue.on('error', (error) => {
        logger.error(`❌ Queue "${queueName}" error: ${error.message}`);
      });
      this.queues.set(queueName, queue);
    }
    return queue;
  }

  async addJob(
    queueName: string,
    jobName: string,
    data: unknown,
    options?: JobOptions,
  ): Promise<string> {
    const queue = this.getQueue(queueName);
    const job = await queue.add(jobName, data, { ...DEFAULT_JOB_OPTIONS, ...options });
    return job.id ?? '';
  }

  async scheduleJob(
    queueName: string,
    schedulerId: string,
    everyMs: number,
    jobName: string,
    data: unknown,
  ): Promise<void> {
    await this.getQueue(queueName).upsertJobScheduler(
      schedulerId,
      { every: everyMs },
      { name: jobName, data, opts: DEFAULT_JOB_OPTIONS },
    );
  }

  registerWorker<T = Record<string, unknown>>(
    queueName: string,
    handler: JobHandler<T>,
    options?: WorkerOptions,
  ): void {
    const worker = new Worker<T>(
      queueName,
      async (bullJob) => {
        const job: QueueJob<T> = {
          id: bullJob.id ?? '',
          name: bullJob.name,
          data: bullJob.data,
          attemptsMade: bullJob.attemptsMade,
        };
        await handler(job);
      },
      {
        connection: this.getWorkerConnection(),
        concurrency: options?.concurrency ?? DEFAULT_CONCURRENCY,
      },
    );

    worker.on('completed', (job) => {
      logger.info(`✅ Job ${job.id} [${job.name}] completed`);
    });

    worker.on('failed', (job, error) => {
      logger.error(`❌ Job ${job?.id} [${job?.name}] failed: ${error.message}`);
    });

    worker.on('error', (error) => {
      logger.error(`❌ Worker "${queueName}" error: ${error.message}`);
    });

    this.workers.push(worker);
    logger.info(`🔄 Worker registered for queue "${queueName}"`);
  }

  async close(): Promise<void> {
    // Close all workers first (lets in-flight jobs finish), then queues, then connections.
    await Promise.all(this.workers.map((w) => w.close()));
    await Promise.all(Array.from(this.queues.values()).map((q) => q.close()));
    // quit() waits for pending replies; disconnect() would drop them.
    await Promise.all([this.producerConnection.quit(), this.workerConnection?.quit()]);
    logger.info('🛑 Queue (BullMQ) connections closed');
  }
}

const bullmqProvider = new BullMQProvider();
export default bullmqProvider;
