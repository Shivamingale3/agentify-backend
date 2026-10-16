import { CacheService } from '@/cache/cache.service.js';
import { Module } from '@nestjs/common';

@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
