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
