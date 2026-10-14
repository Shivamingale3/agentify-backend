/**
 * Type guards that recognise errors thrown by the libraries behind our infrastructure modules.
 * Used by the global exception filter (and services that need a specific case, e.g. unique violation).
 */

// ─── Prisma (postgres driver) ──────────────────────────────────────

/** Query failed in Postgres (constraint violation, bad input, …). `sqlState` is the Postgres SQLSTATE. */
export interface SqlQueryError extends Error {
  kind: 'sql_query';
  sqlState: string | undefined;
  constraint: string | undefined;
}

/** Could not reach / lost connection to Postgres. */
export interface SqlConnectionError extends Error {
  kind: 'sql_connection';
}

export const PG_UNIQUE_VIOLATION = '23505';

// Prisma 8 surfaces driver errors as SqlQueryError / SqlConnectionError (from an internal
// package), so match on their `kind` discriminator instead of importing the classes.
export function isSqlQueryError(error: unknown): error is SqlQueryError {
  return error instanceof Error && 'kind' in error && error.kind === 'sql_query';
}

export function isSqlConnectionError(error: unknown): error is SqlConnectionError {
  return error instanceof Error && 'kind' in error && error.kind === 'sql_connection';
}

export function isUniqueViolation(error: unknown): boolean {
  return isSqlQueryError(error) && error.sqlState === PG_UNIQUE_VIOLATION;
}

// ─── Network ───────────────────────────────────────────────────────

const NETWORK_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
]);

/** Low-level socket error from any outbound connection (DB, Redis, SMTP, HTTP APIs). */
export function isNetworkError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    NETWORK_ERROR_CODES.has(error.code)
  );
}
