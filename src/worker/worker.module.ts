import { ChoresModule } from '@/chores/chores.module.js';
import { validateEnv } from '@/config/env/env.validation.js';
import { DatabaseModule } from '@/database/database.module.js';
import { MailModule } from '@/mail/mail.module.js';
import { QueueModule } from '@/queue/queue.module.js';
import { JobsProcessor } from '@/worker/jobs.processor.js';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

/** Root module of the worker process: no HTTP, only what the job handlers need. */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    DatabaseModule,
    QueueModule,
    MailModule,
    ChoresModule,
  ],
  providers: [JobsProcessor],
})
export class WorkerModule {}
