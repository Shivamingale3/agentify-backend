import { ChoresService } from '@/chores/chores.service.js';
import { Module } from '@nestjs/common';

@Module({
  providers: [ChoresService],
  exports: [ChoresService],
})
export class ChoresModule {}
