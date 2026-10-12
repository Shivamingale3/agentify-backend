// Prisma 8 reads/writes DateTime columns as Temporal values; Node < 26.8.2 has no global Temporal.
import 'temporal-polyfill/full/global';
import postgres from '@prisma/orm-postgres/runtime';
import { env } from '#providers/env.provider.js';
import type { Contract } from '#prisma/contract.js';
import contractJson from '#prisma/contract.json' with { type: 'json' };

export const dbInstance = postgres<Contract>({
  contractJson,
  url: env.DATABASE_URL,
  poolOptions: { connectionTimeoutMillis: 2000 },
});

export const db = dbInstance.orm;
export type Orm = typeof db;
