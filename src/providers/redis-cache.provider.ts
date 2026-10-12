import { createClient, type RedisClientType } from 'redis';
import { env } from '#providers/env.provider.js';
import { logger } from '#utils/logger.js';
import type { CacheProvider } from '#interfaces/cache.interface.js';

class RedisCacheProvider implements CacheProvider {
  private cacheInstance: RedisClientType;

  constructor() {
    this.cacheInstance = createClient({
      url: env.CACHE_URL,
      password: env.CACHE_PASS,
      // While Redis is down, fail commands immediately (→ cache miss) instead of
      // queueing them and hanging the request until Redis comes back.
      disableOfflineQueue: true,
    });

    // node-redis crashes the process on an unhandled 'error' event (e.g. Redis restart).
    this.cacheInstance.on('error', (error: Error) => {
      logger.error(`❌ Redis Cache error: ${error.message}`);
    });
  }

  public async checkConnection(): Promise<void> {
    try {
      await this.cacheInstance.connect();
      logger.info('✅ Redis Connection Successsful');
    } catch (error) {
      logger.error(
        `❌ Redis Connection Failed : ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
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
        await this.cacheInstance.set(key, value, { expiration: { type: 'PX', value: ttl } });
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

  public async close(): Promise<void> {
    // close() waits for pending commands; destroy() would reject them.
    await this.cacheInstance.close();
    logger.info('🛑 Redis Cache connection closed');
  }
}
const cacheProvider = new RedisCacheProvider();
export default cacheProvider;
