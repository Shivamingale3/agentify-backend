import { ResponseMessage } from '@/common/decorators/response-message.decorator.js';
import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, type Observable } from 'rxjs';

export interface ApiResponse<T> {
  success: true;
  message: string;
  data: T;
}

/** Wraps whatever a handler returns in `{ success, message, data }`; errors are shaped by AllExceptionsFilter. */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T | null>> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T | null>> {
    const message = this.reflector.get(ResponseMessage, context.getHandler()) ?? 'Success';
    return next.handle().pipe(map((data) => ({ success: true, message, data: data ?? null })));
  }
}
