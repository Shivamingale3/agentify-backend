import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';
import { isStructuredError } from '@prisma/orm-postgres/utils/structured-error';
import { HttpException } from '#exceptions/http.exception.js';
import {
  isExposedHttpError,
  isNetworkError,
  isRedisError,
  isSqlConnectionError,
  isSqlQueryError,
} from '#utils/errorGuards.js';
import { logger } from '#utils/logger.js';

interface ResolvedError {
  status: number;
  message: string;
  source: 'http' | 'validation' | 'request' | 'database' | 'redis' | 'network' | 'unknown';
}

const UNAVAILABLE = 'Service temporarily unavailable, please try again';

/** Map a Postgres SQLSTATE to a client-safe response. https://www.postgresql.org/docs/current/errcodes-appendix.html */
function resolveSqlState(sqlState: string | undefined): Omit<ResolvedError, 'source'> {
  switch (sqlState) {
    case '23505':
      return { status: StatusCodes.CONFLICT, message: 'Resource already exists' };
    case '23503':
      return { status: StatusCodes.CONFLICT, message: 'Related resource missing or still in use' };
    case '23502':
      return { status: StatusCodes.BAD_REQUEST, message: 'Missing required field' };
    case '23514':
      return { status: StatusCodes.BAD_REQUEST, message: 'Invalid value' };
  }
  // 22xxx = data exception (value too long, invalid format, …)
  if (sqlState?.startsWith('22')) {
    return { status: StatusCodes.BAD_REQUEST, message: 'Invalid input' };
  }
  // 08xxx = connection exception, 53xxx = insufficient resources, 57xxx = operator intervention
  if (sqlState && ['08', '53', '57'].some((cls) => sqlState.startsWith(cls))) {
    return { status: StatusCodes.SERVICE_UNAVAILABLE, message: UNAVAILABLE };
  }
  return { status: StatusCodes.INTERNAL_SERVER_ERROR, message: 'Internal Server Error' };
}

function resolveError(err: unknown): ResolvedError {
  if (err instanceof HttpException) {
    return { status: err.statusCode, message: err.message, source: 'http' };
  }

  if (err instanceof ZodError) {
    return {
      status: StatusCodes.BAD_REQUEST,
      message: err.issues[0]?.message ?? 'Validation failed',
      source: 'validation',
    };
  }

  // Malformed JSON / body too large from express.json()
  if (isExposedHttpError(err)) {
    return {
      status: err.status,
      message: err.status === 413 ? 'Request body too large' : 'Malformed request body',
      source: 'request',
    };
  }

  // ─── Prisma ───
  if (isSqlQueryError(err)) {
    return { ...resolveSqlState(err.sqlState), source: 'database' };
  }
  if (isSqlConnectionError(err)) {
    return { status: StatusCodes.SERVICE_UNAVAILABLE, message: UNAVAILABLE, source: 'database' };
  }
  if (isStructuredError(err)) {
    // DRIVER.* = connection problems; everything else (ORM.*, RUNTIME.*, CONTRACT.*) is a bug on our side.
    return err.code.startsWith('DRIVER.')
      ? { status: StatusCodes.SERVICE_UNAVAILABLE, message: UNAVAILABLE, source: 'database' }
      : {
          status: StatusCodes.INTERNAL_SERVER_ERROR,
          message: 'Internal Server Error',
          source: 'database',
        };
  }

  // ─── Redis (queue / cache) ───
  if (isRedisError(err)) {
    return { status: StatusCodes.SERVICE_UNAVAILABLE, message: UNAVAILABLE, source: 'redis' };
  }

  // ─── Any other outbound connection (SMTP, external APIs, …) ───
  if (isNetworkError(err)) {
    return { status: StatusCodes.SERVICE_UNAVAILABLE, message: UNAVAILABLE, source: 'network' };
  }

  return {
    status: StatusCodes.INTERNAL_SERVER_ERROR,
    message: 'Internal Server Error',
    source: 'unknown',
  };
}

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  const { status, message, source } = resolveError(err);
  const context = `[${source}] ${req.method} ${req.originalUrl} → ${status}`;

  // 5xx: our problem, log the full stack. 4xx: client problem, a one-liner is enough.
  if (status >= 500) {
    logger.error(`${context}: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
  } else {
    logger.warn(`${context}: ${message}`);
  }

  res.status(status).json({
    success: false,
    message,
  });
}
