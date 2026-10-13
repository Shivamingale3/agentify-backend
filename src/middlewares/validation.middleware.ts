import type { NextFunction, Request, Response } from 'express';
import { ZodError, type z } from 'zod';
import { HttpException } from '#exceptions/http.exception.js';
import deviceHeadersSchema from '#validationSchemas/auth/deviceHeaders.schema.js';

export const validationMiddleware = (
  schema: z.ZodType,
  source: 'body' | 'query' | 'params' | 'headers' = 'body',
) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const validatedData = await schema.parseAsync(req[source]);
      switch (source) {
        case 'body':
          req.body = validatedData;
          break;
        case 'query':
          Object.defineProperty(req, 'query', {
            value: validatedData,
            writable: true,
            enumerable: true,
            configurable: true,
          });
          break;
        case 'params':
          Object.defineProperty(req, 'params', {
            value: validatedData,
            writable: true,
            enumerable: true,
            configurable: true,
          });
          break;
        case 'headers':
          Object.defineProperty(req, 'headers', {
            value: validatedData,
            writable: true,
            enumerable: true,
            configurable: true,
          });
          break;
        default:
          Object.defineProperty(req, 'headers', {
            value: await deviceHeadersSchema.parseAsync(req.headers),
            writable: true,
            enumerable: true,
            configurable: true,
          });
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const message = error.issues[0]?.message ?? 'Validation failed';
        next(new HttpException(400, message));
      } else {
        next(error);
      }
    }
  };
};
