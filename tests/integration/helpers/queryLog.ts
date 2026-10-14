import type { SqlMiddleware } from '@prisma/orm-postgres/family-runtime';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from '#prisma/contract.js';
import contractJson from '#prisma/contract.json' with { type: 'json' };
import type { Orm } from '#providers/db.provider.js';

/**
 * A second client on the test database that records every SQL statement it runs, so tests can
 * assert round-trip counts (pass `orm` to a service method). Call `close()` in afterAll.
 */
export function queryLogOrm(): { orm: Orm; sql: string[]; close: () => Promise<void> } {
  const sql: string[] = [];
  const recorder: SqlMiddleware = {
    name: 'test-query-log',
    familyId: 'sql',
    async afterQuery(plan) {
      sql.push(plan.sql);
    },
  };
  const instance = postgres<Contract>({
    contractJson,
    url: process.env['DATABASE_URL'] ?? '',
    middleware: [recorder],
  });
  return { orm: instance.orm, sql, close: () => instance.close() };
}
