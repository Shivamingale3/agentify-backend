import { errorStack } from '@/common/utils/error-guards.js';
import type { Env } from '@/config/env/env.schema.js';
import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { setTimeout as sleep } from 'node:timers/promises';
import { createClient } from 'redis';
import { z } from 'zod';

const CONNECT_TIMEOUT_MS = 5000;

@Injectable()
export class CacheService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(CacheService.name);
  private readonly client: ReturnType<typeof createClient>;

  constructor(config: ConfigService<Env, true>) {
    this.client = createClient({
      url: config.get('CACHE_URL', { infer: true }),
      password: config.get('CACHE_PASS', { infer: true }),
      // While Redis is down, fail commands immediately (a cache miss) instead of queueing them.
      disableOfflineQueue: true,
    });
    // node-redis crashes the process on an unhandled 'error' event (e.g. a Redis restart).
    this.client.on('error', (error: Error) => {
      this.logger.error(`Redis error: ${error.message}`);
    });
  }

  async onModuleInit(): Promise<void> {
    // connect() keeps retrying while Redis is down; fail the boot instead of hanging silently.
    const timeout = sleep(CONNECT_TIMEOUT_MS, undefined, { ref: false }).then(() => {
      throw new Error(`Redis not reachable within ${CONNECT_TIMEOUT_MS}ms`);
    });
    await Promise.race([this.client.connect(), timeout]);
    this.logger.log('Cache connected');
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
    this.logger.log('Cache connection closed');
  }

  /** Cached data is untrusted input: a value that fails the schema is treated as a miss. */
  async get<T>(key: string, schema: z.ZodType<T>): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      if (raw === null) return null;
      const parsed: unknown = JSON.parse(raw);
      const result = schema.safeParse(parsed);
      if (!result.success) {
        this.logger.warn(`Cached value failed validation: ${z.prettifyError(result.error)}`);
        return null;
      }
      return result.data;
    } catch (error) {
      this.logger.error('Cache get failed', errorStack(error));
      return null;
    }
  }

  /** `ttlMs` is in milliseconds; omit it to keep the key until it is deleted. */
  async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
    try {
      const options = ttlMs ? { expiration: { type: 'PX', value: ttlMs } as const } : undefined;
      await this.client.set(key, JSON.stringify(value), options);
    } catch (error) {
      this.logger.error('Cache set failed', errorStack(error));
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.error('Cache del failed', errorStack(error));
    }
  }
}
