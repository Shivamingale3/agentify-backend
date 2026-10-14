import z from 'zod';

// Optional client labels that login stores on the session (clientName / clientType), e.g. for an
// "active devices" list. They're client-controlled, so:
// - max(100): headers can be ~16 KB; without a cap every login could write that much junk to
//   the sessions table and Redis.
// - catch(undefined): they're cosmetic, so a bad value must never block a login. It falls back to
//   undefined, which auth.service stores as 'Unknown'.
// Still render them escaped in any UI: the limits don't make the content safe HTML.
const deviceHeader = z.string().trim().min(1).max(100).optional().catch(undefined);

const deviceHeadersSchema = z
  .object({
    'x-client-name': deviceHeader,
    'x-client-type': deviceHeader,
  })
  // Keep every other header: the validation middleware replaces req.headers with this output.
  .loose();

export default deviceHeadersSchema;
