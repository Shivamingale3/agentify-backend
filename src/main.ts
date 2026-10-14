import { AppModule } from '@/app.module.js';
import type { Env } from '@/config/env/env.schema.js';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<Env, true>);
  await app.listen(config.get('APP_PORT', { infer: true }));
}
await bootstrap();
