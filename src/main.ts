import { AppModule } from '@/app.module.js';
import type { Env } from '@/config/env/env.schema.js';
import { ConsoleLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.enableShutdownHooks();
  const config = app.get(ConfigService<Env, true>);
  const appEnv = config.get('APP_ENV', { infer: true });
  app.useLogger(
    new ConsoleLogger({
      json: appEnv === 'production',
      logLevels:
        appEnv === 'development' ? ['debug', 'log', 'warn', 'error'] : ['log', 'warn', 'error'],
    }),
  );
  await app.listen(config.get('APP_PORT', { infer: true }));
}
await bootstrap();
