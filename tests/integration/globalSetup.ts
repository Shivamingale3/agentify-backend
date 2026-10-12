import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import type { TestProject } from 'vitest/node';

const run = promisify(execFile);

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
    redisHost: string;
    redisPort: number;
    redisPassword: string;
  }
}

/**
 * Starts throwaway Postgres + Redis containers once per run and applies the current contract.
 * Only ever touches these containers — never the DATABASE_URL in your .env.
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const [postgres, redis]: [StartedPostgreSqlContainer, StartedRedisContainer] = await Promise.all([
    new PostgreSqlContainer('postgres:17-alpine').start(),
    new RedisContainer('redis:7-alpine').withPassword('test').start(),
  ]);

  const databaseUrl = postgres.getConnectionUri();

  // Fresh empty DB: `db update` only creates tables, so there is nothing destructive to confirm.
  // An explicit --db also stops Prisma from advancing the project's `db` migration ref.
  await run('npx', ['prisma', 'db', 'update', '--db', databaseUrl, '--no-interactive'], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  project.provide('databaseUrl', databaseUrl);
  project.provide('redisHost', redis.getHost());
  project.provide('redisPort', redis.getPort());
  project.provide('redisPassword', redis.getPassword());

  return async () => {
    await Promise.all([postgres.stop(), redis.stop()]);
  };
}
