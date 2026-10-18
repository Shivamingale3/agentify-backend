import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';

// Optional client labels that login stores on the session (e.g. for an "active devices" list).
// They're client-controlled, so:
// - max(100): headers can be ~16 KB; without a cap every login could write that much junk to
//   the sessions table and Redis.
// - catch(undefined): they're cosmetic, so a bad value must never block a login.
// Still render them escaped in any UI: the limits don't make the content safe HTML.
const deviceHeader = z.string().trim().min(1).max(100).optional().catch(undefined);

export const deviceHeadersSchema = z
  .object({ 'x-client-name': deviceHeader, 'x-client-type': deviceHeader })
  .transform((headers) => ({
    clientName: headers['x-client-name'],
    clientType: headers['x-client-type'],
  }));

export type DeviceInfo = z.output<typeof deviceHeadersSchema>;

/**
 * The validated device labels from the request headers. A decorator because Nest never runs pipes
 * on @Headers(). It can't fail: bad values become undefined.
 */
export const DeviceHeaders = createParamDecorator(
  (_data: unknown, context: ExecutionContext): DeviceInfo =>
    deviceHeadersSchema.parse(context.switchToHttp().getRequest<Request>().headers),
);
