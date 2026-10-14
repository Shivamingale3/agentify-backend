import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from '@/config/env/env.validation.js';
import { AppController } from '@/app.controller.js';
import { AppService } from '@/app.service.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
