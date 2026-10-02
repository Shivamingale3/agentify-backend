import { app } from './app.js';
import { dbInstance } from './providers/db.provider.js';
import { env } from './providers/env.provider.js';
import cacheService from './services/cache.service.js';
import mailService from './services/mail.service.js';
import { logger } from './utils/logger.js';

async function startServer(): Promise<void> {
  try {
    // Database Health Check
    // connect() only builds the lazy pool; acquiring a connection actually hits the DB
    const conn = await (await dbInstance.connect()).connection();
    await conn.release();
    logger.info('✅ Database Connection Successful');

    // Test Cache
    await cacheService.checkConnection();

    // Test Mail Service
    await mailService.checkConnection();

    // Start Express Server
    app.listen(env.APP_PORT, () => {
      logger.info(`✅ Server Initialization Success`);
      logger.info(`🌍 http://localhost: ${env.APP_PORT}/`);
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
