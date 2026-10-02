import type { Server } from 'node:http';
import { app } from '#app.js';
import { dbInstance } from '#providers/db.provider.js';
import { env } from '#providers/env.provider.js';
import cacheService from '#services/cache.service.js';
import mailService from '#services/mail.service.js';
import queueService from '#services/queue.service.js';
import { logger } from '#utils/logger.js';

// If closing hangs (stuck request, long job), exit anyway instead of waiting for SIGKILL.
const SHUTDOWN_TIMEOUT_MS = 10_000;

async function startServer(): Promise<void> {
  try {
    // Database Health Check
    // connect() only builds the lazy pool; acquiring a connection actually hits the DB
    const conn = await (await dbInstance.connect()).connection();
    await conn.release();
    logger.info('✅ Database Connection Successful');

    // Test Cache
    await cacheService.checkConnection();

    // Test Queue
    await queueService.checkConnection();

    // Test Mail Service
    await mailService.checkConnection();

    // Start Express Server
    const server = app.listen(env.APP_PORT, () => {
      logger.info(`✅ Server Initialization Success`);
      logger.info(`🌍 http://localhost: ${env.APP_PORT}/`);
    });

    registerShutdown(server);
  } catch (error) {
    logger.error('Failed to connect to the database or start the server:', error);
    process.exit(1);
  }
}

function registerShutdown(server: Server): void {
  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`🛑 ${signal} received, shutting down`);

    setTimeout(() => {
      logger.error(`❌ Shutdown took longer than ${SHUTDOWN_TIMEOUT_MS}ms, forcing exit`);
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();

    // 1. Stop accepting connections; in-flight requests finish first.
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
    logger.info('🛑 HTTP server closed');

    // 2. Release backing services (workers finish their current job before closing).
    mailService.shutdown();
    const results = await Promise.allSettled([
      queueService.shutdown(),
      cacheService.shutdown(),
      dbInstance.close().then(() => {
        logger.info('🛑 Database pool closed');
      }),
    ]);

    const failures = results.filter((result) => result.status === 'rejected');
    for (const failure of failures) {
      logger.error(`❌ Shutdown error: ${String(failure.reason)}`);
    }
    process.exit(failures.length > 0 ? 1 : 0);
  };

  process.once('SIGTERM', (signal) => void shutdown(signal));
  process.once('SIGINT', (signal) => void shutdown(signal));
}

startServer().catch((error: unknown) => {
  logger.error('Unexpected error during startup:', error);
  process.exit(1);
});
