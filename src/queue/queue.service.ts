import { JOBS_QUEUE, type JobPayload } from '@/queue/jobs.types.js';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';

/** Producer side of the jobs queue: the API and the worker both enqueue through this. */
@Injectable()
export class QueueService implements OnModuleInit {
  private readonly logger = new Logger(QueueService.name);

  constructor(@InjectQueue(JOBS_QUEUE) private readonly queue: Queue<JobPayload>) {
    // An EventEmitter 'error' without a listener crashes the process (e.g. on a Redis restart).
    this.queue.on('error', (error) => {
      this.logger.error(`Queue error: ${error.message}`);
    });
  }

  async onModuleInit(): Promise<void> {
    // The connection is lazy; one real command makes an unreachable queue Redis fail the boot
    // (maxRetriesPerRequest: 1 turns an outage into an error instead of a wait).
    await this.queue.getJobCounts();
    this.logger.log('Queue connected');
  }

  /** Enqueue a job, e.g. `enqueue({ type: 'email', data: {...} })`. */
  async enqueue(payload: JobPayload): Promise<void> {
    const job = await this.queue.add(payload.type, payload);
    this.logger.log(`Enqueued ${payload.type} job ${job.id ?? ''}`);
  }

  /** Run a job every `everyMs`. Idempotent per scheduler id, so each worker calls it on boot. */
  async schedule(schedulerId: string, everyMs: number, payload: JobPayload): Promise<void> {
    await this.queue.upsertJobScheduler(
      schedulerId,
      { every: everyMs },
      { name: payload.type, data: payload },
    );
  }
}
