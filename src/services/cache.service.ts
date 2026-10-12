import type { ZodType } from 'zod';
import type { CacheProvider } from '#interfaces/cache.interface.js';
import { safeParseCached } from '#utils/zodValidator.js';
import { logger } from '#utils/logger.js';
import cacheProvider from '#providers/redis-cache.provider.js';

/**
 * CacheService owns serialization (JSON) and validation (Zod).
 * The provider underneath is a dumb string I/O layer that can be
 * swapped (Redis → Memcached → in-memory) without touching this code.
 */
class CacheService {
  private provider: CacheProvider;

  constructor(provider: CacheProvider) {
    this.provider = provider;
  }

  public async checkConnection(): Promise<void> {
    return this.provider.checkConnnection();
  }

  public async get<T = unknown>(key: string, schema?: ZodType<T>): Promise<T | null> {
    try {
      const raw = await this.provider.get(key);
      if (!raw) {
        return null;
      }

      if (schema) {
        return safeParseCached<T>(raw, schema);
      }

      return JSON.parse(raw) as T;
    } catch (error) {
      logger.error(`❌ Cache Get Failed`, error);
      return null;
    }
  }

  public async set(key: string, value: unknown, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.provider.set(key, serialized, ttl);
    } catch (error) {
      logger.error(`❌ Cache Set Failed`, error);
    }
  }

  public async del(key: string): Promise<void> {
    await this.provider.del(key);
  }

  public async flush(): Promise<void> {
    await this.provider.flush();
  }

  /** Graceful shutdown — call on SIGTERM / SIGINT. */
  public async shutdown(): Promise<void> {
    return this.provider.close();
  }
}

// Default instance wired to the Redis provider.
// Swap `cacheProvider` for any other CacheProvider implementation to change backends.
const cacheService = new CacheService(cacheProvider);
export default cacheService;
