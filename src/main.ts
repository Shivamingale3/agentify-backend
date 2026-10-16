import { AppModule } from '@/app.module.js';
import { AppLogger } from '@/common/logger/app.logger.js';
import type { Env } from '@/config/env/env.schema.js';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.enableShutdownHooks();
  const config = app.get(ConfigService<Env, true>);
  const appEnv = config.get('APP_ENV', { infer: true });
  app.useLogger(
    new AppLogger({
      json: appEnv === 'production',
      logLevels:
        appEnv === 'development' ? ['debug', 'log', 'warn', 'error'] : ['log', 'warn', 'error'],
    }),
  );

  // nginx (the frontend container) fronts this backend and sets X-Forwarded-*; trust exactly that one hop.
  app.set('trust proxy', 1);
  app.use(helmet());
  // Only listed origins get CORS headers; cookies allowed for auth.
  app.enableCors({ origin: config.get('ALLOWED_ORIGINS', { infer: true }), credentials: true });
  app.use(cookieParser());
  app.setGlobalPrefix('api');

  await app.listen(config.get('APP_PORT', { infer: true }));
  new Logger('Bootstrap').log(`Listening on ${config.get('APP_URL', { infer: true })}/api`);
}
await bootstrap();
