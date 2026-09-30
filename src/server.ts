import { app } from './app.js';
import { db } from './config/db.config.js';
import { env } from './config/env.config.js';
import { logger } from './utils/logger.js';

async function startServer(): Promise<void> {
  try {
    // Database Health Check
    // connect() only builds the lazy pool; acquiring a connection actually hits the DB
    const conn = await (await db.connect()).connection();
    await conn.release();
    logger.info('Database connection established successfully.');

    // Start Express Server
    app.listen(env.APP_PORT, () => {
      logger.info(`Server is running on port ${env.APP_PORT}`);
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
