import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const start = Date.now();

    response.on('finish', () => {
      const duration = Date.now() - start;
      this.logger.log(
        `${request.method} ${request.originalUrl} ${response.statusCode} ${duration}ms`,
      );
    });

    next();
  }
}
