import type { Env } from '@/config/env/env.schema.js';
import { JOBS_QUEUE } from '@/queue/jobs.types.js';
import { QueueService } from '@/queue/queue.service.js';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        connection: {
          host: config.get('QUEUE_HOST', { infer: true }),
          port: config.get('QUEUE_PORT', { infer: true }),
          password: config.get('QUEUE_PASS', { infer: true }),
          // Producers fail fast on a Redis outage instead of hanging the request.
          // BullMQ forces this to null on its own worker connections, as blocking reads require.
          maxRetriesPerRequest: 1,
          // ioredis waits 10 s per connect attempt by default.
          connectTimeout: 5000,
        },
        // A queue first used during a Redis outage would otherwise wait for 'ready' forever.
        skipWaitingForReady: true,
        // Namespaces every key (`agentify:jobs:*`), so this app never shares jobs with another
        // app on the same Redis.
        prefix: 'agentify',
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { age: 7 * 24 * 60 * 60, count: 1000 },
        },
      }),
    }),
    BullModule.registerQueue({ name: JOBS_QUEUE }),
  ],
  providers: [QueueService],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
