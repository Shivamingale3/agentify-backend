import postgres from '@prisma/orm-postgres/runtime';
import { env } from './env.config.js';
import type { Contract } from '../prisma/contract.d.ts';
import contractJson from '../prisma/contract.json' with { type: 'json' };

export const db = postgres<Contract>({
  contractJson,
  url: env.DATABASE_URL,
  poolOptions: { connectionTimeoutMillis: 2000 },
});
