import { createClient, type RedisClientType } from 'redis';
import { env } from './env.provider';
import { logger } from '../utils/logger';
import type { CacheProvider } from '../interfaces/cache.interface';

class RedisCacheProvider implements CacheProvider {
  private cacheInstance: RedisClientType;

  constructor() {
    this.cacheInstance = createClient({
      url: env.CACHE_URL,
      password: env.CACHE_PASS,
    });
  }

  public async checkConnnection(): Promise<void> {
    try {
      await this.cacheInstance.connect();
      logger.info('✅ Redis Connection Successsful');
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`❌ Redis Connection Failed : ${error.message}`);
      }
      logger.error(`❌ Redis Connection Failed`, error);
      process.exit(1);
    }
  }

  public async get(key: string): Promise<string | null> {
    try {
      return await this.cacheInstance.get(key);
    } catch (error) {
      logger.error(`❌ Redis Get Failed`, error);
      return null;
    }
  }

  public async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        await this.cacheInstance.set(key, value, { EX: ttl });
      } else {
        await this.cacheInstance.set(key, value);
      }
    } catch (error) {
      logger.error(`❌ Redis Set Failed`, error);
    }
  }

  public async del(key: string): Promise<void> {
    try {
      await this.cacheInstance.del(key);
    } catch (error) {
      logger.error(`❌ Redis Delete Failed`, error);
    }
  }

  public async flush(): Promise<void> {
    try {
      await this.cacheInstance.flushAll();
    } catch (error) {
      logger.error(`❌ Redis Flush Failed`, error);
    }
  }
}
const cacheProvider = new RedisCacheProvider();
export default cacheProvider;
