import { app } from '#app.js';
import { registerShutdown, settleAll } from '#lib/shutdown.js';
import { dbInstance } from '#providers/db.provider.js';
import { env } from '#providers/env.provider.js';
import cacheService from '#services/cache.service.js';
import mailService from '#services/mail.service.js';
import queueService from '#services/queue.service.js';
import { logger } from '#utils/logger.js';

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

    registerShutdown(async () => {
      // 1. Stop accepting connections; in-flight requests finish first.
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
      logger.info('🛑 HTTP server closed');

      // 2. Release backing services.
      mailService.shutdown();
      await settleAll([
        queueService.shutdown(),
        cacheService.shutdown(),
        dbInstance.close().then(() => {
          logger.info('🛑 Database pool closed');
        }),
      ]);
    });
  } catch (error) {
    logger.error('Failed to connect to the database or start the server:', error);
    process.exit(1);
  }
}

startServer().catch((error: unknown) => {
  logger.error('Unexpected error during startup:', error);
  process.exit(1);
});
