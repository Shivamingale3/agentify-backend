import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { logger } from '#utils/logger.js';
import { safeParseCached } from '#utils/zodValidator.js';

const schema = z.object({ id: z.string(), count: z.number() });

describe('safeParseCached', () => {
  it('returns the parsed, typed data for valid JSON matching the schema', () => {
    expect(safeParseCached('{"id":"a","count":2}', schema)).toEqual({ id: 'a', count: 2 });
  });

  it('applies schema transforms and strips unknown keys', () => {
    const trimmed = z.object({ name: z.string().trim() });
    expect(safeParseCached('{"name":"  bob  ","extra":1}', trimmed)).toEqual({ name: 'bob' });
  });

  it('returns null and warns when the JSON does not match the schema', () => {
    const warn = vi.spyOn(logger, 'warn');
    expect(safeParseCached('{"id":"a","count":"2"}', schema)).toBeNull();
    expect(warn).toHaveBeenCalledWith('⚠️ Cache validation failed', expect.anything());
  });

  it.each(['not json', '', '{"id":'])('returns null and warns for unparseable %j', (raw) => {
    const warn = vi.spyOn(logger, 'warn');
    expect(safeParseCached(raw, schema)).toBeNull();
    expect(warn).toHaveBeenCalledWith('⚠️ Cache JSON parse failed');
  });
});
