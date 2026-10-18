import { ChoresService } from '@/chores/chores.service.js';
import type { Env } from '@/config/env/env.schema.js';
import { MailService } from '@/mail/mail.service.js';
import { jobPayloadSchema } from '@/queue/job-payload.schema.js';
import { JOBS_QUEUE, type JobPayload } from '@/queue/jobs.types.js';
import { QueueService } from '@/queue/queue.service.js';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UnrecoverableError, type Job } from 'bullmq';
import { setTimeout as sleep } from 'node:timers/promises';
import { z } from 'zod';

const ONE_HOUR_MS = 60 * 60 * 1000;

/** Consumes the jobs queue: validates each payload, then runs the handler for its `type`. */
@Processor(JOBS_QUEUE)
export class JobsProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(JobsProcessor.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly queue: QueueService,
    private readonly mail: MailService,
    private readonly chores: ChoresService,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    // @Processor() options are static, so the env-driven concurrency is set on the live worker.
    this.worker.concurrency = this.config.get('WORKER_CONCURRENCY', { infer: true });
    // Idempotent per scheduler id: any number of worker processes still produce one job an hour.
    await this.queue.schedule('cleanup-chores', ONE_HOUR_MS, { type: 'cleanupChores', data: {} });
  }

  /** Job data comes from Redis (maybe from another deploy), so it is untrusted until parsed. */
  async process(job: Job): Promise<void> {
    const id = job.id ?? '';
    const parsed = jobPayloadSchema.safeParse(job.data);
    if (!parsed.success) {
      // Retrying cannot fix a malformed payload: fail it once instead of using up every attempt.
      throw new UnrecoverableError(`Invalid payload: ${z.prettifyError(parsed.error)}`);
    }
    await this.handle(parsed.data, id, job.attemptsMade);
  }

  private async handle(payload: JobPayload, id: string, attemptsMade: number): Promise<void> {
    switch (payload.type) {
      case 'email':
        await this.mail.sendMail(payload.data);
        // Job id, not the address: BullMQ keeps failed jobs (with the recipient) for 7 days.
        this.logger.log(`Email job ${id} sent`);
        return;
      case 'cleanupChores': {
        const deleted = await this.chores.deleteExpired();
        this.logger.log(`Job ${id} removed ${deleted} expired chores`);
        return;
      }
      case 'build':
        // Placeholder for the agent run.
        this.logger.log(
          `Build job ${id} for project ${payload.data.projectId} (attempt ${attemptsMade + 1})`,
        );
        await sleep(1000);
        return;
      default: {
        // Adding a type to JobPayload without a case here fails to compile.
        const unhandled: never = payload;
        throw new UnrecoverableError(`No handler for job ${JSON.stringify(unhandled)}`);
      }
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(`Job ${job?.id ?? ''} [${job?.name ?? ''}] failed: ${error.message}`);
  }

  @OnWorkerEvent('error')
  onError(error: Error): void {
    this.logger.error(`Worker error: ${error.message}`);
  }
}
