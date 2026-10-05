import { logger } from '#utils/logger.js';

// If closing hangs (stuck request, long job), exit anyway instead of waiting for SIGKILL.
const SHUTDOWN_TIMEOUT_MS = 10_000;

/**
 * Run `cleanup` once on SIGTERM / SIGINT, then exit (0 on success, 1 on failure).
 * Shared by every entry point (server.ts, worker.ts); each passes its own cleanup.
 */
export function registerShutdown(cleanup: () => Promise<void>): void {
  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`🛑 ${signal} received, shutting down`);

    setTimeout(() => {
      logger.error(`❌ Shutdown took longer than ${SHUTDOWN_TIMEOUT_MS}ms, forcing exit`);
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();

    try {
      await cleanup();
      process.exit(0);
    } catch (error) {
      logger.error(`❌ Shutdown failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  };

  process.once('SIGTERM', (signal) => void shutdown(signal));
  process.once('SIGINT', (signal) => void shutdown(signal));
}

/** Close resources in parallel; log every failure and throw if any failed. */
export async function settleAll(tasks: Promise<unknown>[]): Promise<void> {
  const results = await Promise.allSettled(tasks);
  const failures = results.filter((result) => result.status === 'rejected');
  for (const failure of failures) {
    logger.error(`❌ Shutdown error: ${String(failure.reason)}`);
  }
  if (failures.length > 0) {
    throw new Error(`${failures.length} resource(s) failed to close`);
  }
}
