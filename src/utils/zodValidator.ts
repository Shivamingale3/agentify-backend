import { z, type ZodType } from 'zod';
import { logger } from '#utils/logger.js';

/**
 * Parses a JSON string and validates it against the provided Zod schema.
 * Returns the validated & typed data on success, or `null` if JSON parsing
 * or schema validation fails.
 */
export function safeParseCached<T>(raw: string, schema: ZodType<T>): T | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    const result = schema.safeParse(parsed);

    if (!result.success) {
      logger.warn('⚠️ Cache validation failed', z.treeifyError(result.error));
      return null;
    }

    return result.data;
  } catch {
    logger.warn('⚠️ Cache JSON parse failed');
    return null;
  }
}
