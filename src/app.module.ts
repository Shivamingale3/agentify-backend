import { CacheModule } from '@/cache/cache.module.js';
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter.js';
import { ResponseInterceptor } from '@/common/interceptors/response.interceptor.js';
import { HttpLoggerMiddleware } from '@/common/middleware/http-logger.middleware.js';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe.js';
import { validateEnv } from '@/config/env/env.validation.js';
import { DatabaseModule } from '@/database/database.module.js';
import { HealthModule } from '@/health/health.module.js';
import { MailModule } from '@/mail/mail.module.js';
import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    DatabaseModule,
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 60 }],
      errorMessage: 'Too many requests, please try again later.',
    }),
    HealthModule,
    CacheModule,
    MailModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(HttpLoggerMiddleware).forRoutes('{*path}');
  }
}
