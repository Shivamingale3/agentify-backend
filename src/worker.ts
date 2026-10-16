import { AppLogger } from '@/common/logger/app.logger.js';
import type { Env } from '@/config/env/env.schema.js';
import { WorkerModule } from '@/worker/worker.module.js';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

/** Worker process entry point. Runs apart from the API; start as many copies as you need. */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  app.enableShutdownHooks();
  const config = app.get(ConfigService<Env, true>);
  app.useLogger(AppLogger.forEnv(config.get('APP_ENV', { infer: true })));

  const concurrency = config.get('WORKER_CONCURRENCY', { infer: true });
  new Logger('Bootstrap').log(`Worker started (pid ${process.pid}, concurrency ${concurrency})`);
}
await bootstrap();
