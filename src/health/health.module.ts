import { HealthController } from '@/health/health.controller.js';
import { Module } from '@nestjs/common';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
