import { afterAll, beforeAll, beforeEach, inject } from 'vitest';

// Point the app at the Testcontainers services BEFORE any app module loads:
// providers read env and open clients at import time, so app code is imported dynamically below.
const redisHost = inject('redisHost');
const redisPort = inject('redisPort');
const redisPassword = inject('redisPassword');
process.env['DATABASE_URL'] = inject('databaseUrl');
process.env['CACHE_URL'] = `redis://${redisHost}:${String(redisPort)}`;
process.env['CACHE_PASS'] = redisPassword;
process.env['QUEUE_HOST'] = redisHost;
process.env['QUEUE_PORT'] = String(redisPort);
process.env['QUEUE_PASS'] = redisPassword;

const { dbInstance } = await import('#providers/db.provider.js');
const { default: cacheService } = await import('#services/cache.service.js');
const { default: queueService } = await import('#services/queue.service.js');

beforeAll(async () => {
  await cacheService.checkConnection();
});

// Every test starts with empty tables and an empty Redis (cache + queued jobs).
beforeEach(async () => {
  await dbInstance.runtime().execute(
    dbInstance.raw.sql`
      DO $$
      DECLARE r record;
      BEGIN
        FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
          EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
        END LOOP;
      END $$;
    `
      .affectedCount()
      .build(),
  );
  await cacheService.flush();
});

afterAll(async () => {
  await Promise.all([cacheService.shutdown(), queueService.shutdown(), dbInstance.close()]);
});
