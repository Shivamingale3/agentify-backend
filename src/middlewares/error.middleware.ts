import type { NextFunction, Request, Response } from 'express';
import { HttpException } from '../exceptions/http.exception.js';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent) {
    _next(err);
    return;
  }

  if (err instanceof HttpException) {
    logger.error(err.message);

    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  if (err instanceof ZodError) {
    const message = err.issues[0]?.message ?? 'Validation failed';
    logger.error(`Validation error: ${message}`);

    res.status(400).json({
      success: false,
      message,
    });
    return;
  }

  logger.error(err instanceof Error ? (err.stack ?? err.message) : String(err));

  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
  });
}
