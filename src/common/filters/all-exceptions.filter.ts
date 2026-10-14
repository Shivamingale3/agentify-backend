import {
  isNetworkError,
  isSqlConnectionError,
  isSqlQueryError,
} from '@/common/utils/error-guards.js';
import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { isStructuredError } from '@prisma/orm-postgres/utils/structured-error';
import type { Request, Response } from 'express';

interface ResolvedError {
  status: number;
  message: string;
  source: 'http' | 'database' | 'network' | 'unknown';
}

const UNAVAILABLE = 'Service temporarily unavailable, please try again';
const INTERNAL = 'Internal Server Error';

/** Map a Postgres SQLSTATE to a client-safe response. https://www.postgresql.org/docs/current/errcodes-appendix.html */
function resolveSqlState(sqlState: string | undefined): Omit<ResolvedError, 'source'> {
  switch (sqlState) {
    case '23505':
      return { status: HttpStatus.CONFLICT, message: 'Resource already exists' };
    case '23503':
      return { status: HttpStatus.CONFLICT, message: 'Related resource missing or still in use' };
    case '23502':
      return { status: HttpStatus.BAD_REQUEST, message: 'Missing required field' };
    case '23514':
      return { status: HttpStatus.BAD_REQUEST, message: 'Invalid value' };
  }
  // 22xxx = data exception (value too long, invalid format, …)
  if (sqlState?.startsWith('22')) {
    return { status: HttpStatus.BAD_REQUEST, message: 'Invalid input' };
  }
  // 08xxx = connection exception, 53xxx = insufficient resources, 57xxx = operator intervention
  if (sqlState && ['08', '53', '57'].some((cls) => sqlState.startsWith(cls))) {
    return { status: HttpStatus.SERVICE_UNAVAILABLE, message: UNAVAILABLE };
  }
  return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: INTERNAL };
}

/** Nest exceptions carry either a string or `{ message: string | string[] }`; take the first message. */
function httpMessage(exception: HttpException): string {
  const body = exception.getResponse();
  if (typeof body === 'string') return body;
  const { message } = body as { message?: string | string[] };
  return (Array.isArray(message) ? message[0] : message) ?? exception.message;
}

function resolveError(exception: unknown): ResolvedError {
  // Covers our own throws, Nest's 404s, and malformed / oversized request bodies.
  if (exception instanceof HttpException) {
    return { status: exception.getStatus(), message: httpMessage(exception), source: 'http' };
  }

  // ─── Prisma ───
  if (isSqlQueryError(exception)) {
    return { ...resolveSqlState(exception.sqlState), source: 'database' };
  }
  if (isSqlConnectionError(exception)) {
    return { status: HttpStatus.SERVICE_UNAVAILABLE, message: UNAVAILABLE, source: 'database' };
  }
  if (isStructuredError(exception)) {
    // DRIVER.* = connection problems; everything else (ORM.*, RUNTIME.*, CONTRACT.*) is a bug on our side.
    return exception.code.startsWith('DRIVER.')
      ? { status: HttpStatus.SERVICE_UNAVAILABLE, message: UNAVAILABLE, source: 'database' }
      : { status: HttpStatus.INTERNAL_SERVER_ERROR, message: INTERNAL, source: 'database' };
  }

  // ─── Any other outbound connection (SMTP, external APIs, …) ───
  if (isNetworkError(exception)) {
    return { status: HttpStatus.SERVICE_UNAVAILABLE, message: UNAVAILABLE, source: 'network' };
  }

  return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: INTERNAL, source: 'unknown' };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const { status, message, source } = resolveError(exception);
    const context = `[${source}] ${req.method} ${req.originalUrl} → ${status}`;

    // 5xx: our problem, log the full stack. 4xx: client problem, a one-liner is enough.
    if (status >= 500) {
      this.logger.error(
        context,
        exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
      );
    } else {
      this.logger.warn(`${context}: ${message}`);
    }

    res.status(status).json({ success: false, message });
  }
}
