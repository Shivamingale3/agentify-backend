import type { ZodType } from 'zod';

/**
 * Parses an LLM's JSON reply, tolerating ```json fences, and validates it against `schema`.
 * AI output is untrusted input: without the schema the result would only be *claimed* to be a T.
 */
export function parseAIResponse<T>(response: string, schema: ZodType<T>): T {
  const cleaned = response
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();

  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch {
    throw new Error('Invalid AI response: not JSON.');
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new Error('Invalid AI response: unexpected shape.');
  }
  return parsed.data;
}
