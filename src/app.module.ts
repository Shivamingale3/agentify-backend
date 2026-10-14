import { AppController } from '@/app.controller.js';
import { AppService } from '@/app.service.js';
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter.js';
import { HttpLoggerMiddleware } from '@/common/middleware/http-logger.middleware.js';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe.js';
import { validateEnv } from '@/config/env/env.validation.js';
import { DatabaseModule } from '@/database/database.module.js';
import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }), DatabaseModule],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(HttpLoggerMiddleware).forRoutes('{*path}');
  }
}
