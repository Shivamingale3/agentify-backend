// Prisma 8 reads/writes DateTime columns as Temporal values; Node 24 has no global Temporal yet.
import 'temporal-polyfill/full/global';

import type { Env } from '@/config/env/env.schema.js';
import type { Contract } from '@/database/prisma/contract.js';
import contractJson from '@/database/prisma/contract.json' with { type: 'json' };
import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import postgres from '@prisma/orm-postgres/runtime';

@Injectable()
export class DatabaseService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);
  readonly client: ReturnType<typeof postgres<Contract>>;

  constructor(config: ConfigService<Env, true>) {
    this.client = postgres<Contract>({
      contractJson,
      url: config.get('DATABASE_URL', { infer: true }),
      poolOptions: { connectionTimeoutMillis: 2000 },
    });
  }

  get orm(): Orm {
    return this.client.orm;
  }

  // connect() only builds the lazy pool; acquiring a connection actually hits the DB.
  async onModuleInit(): Promise<void> {
    const connection = await (await this.client.connect()).connection();
    await connection.release();
    this.logger.log('Database connected');
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
    this.logger.log('Database pool closed');
  }
}

export type Orm = ReturnType<typeof postgres<Contract>>['orm'];
