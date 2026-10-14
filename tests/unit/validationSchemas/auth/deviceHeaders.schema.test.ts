import { describe, expect, it } from 'vitest';
import deviceHeadersSchema from '#validationSchemas/auth/deviceHeaders.schema.js';

describe('deviceHeadersSchema', () => {
  it('keeps valid labels, trimmed', () => {
    expect(
      deviceHeadersSchema.parse({ 'x-client-name': '  Chrome ', 'x-client-type': 'web' }),
    ).toMatchObject({ 'x-client-name': 'Chrome', 'x-client-type': 'web' });
  });

  // Regression: values had no bounds, so any size went into sessions and Redis.
  it.each([['x'.repeat(101)], [''], ['   ']])('drops %j instead of failing', (value) => {
    const parsed = deviceHeadersSchema.parse({ 'x-client-name': value });
    expect(parsed['x-client-name']).toBeUndefined();
  });

  it('keeps all other headers', () => {
    expect(deviceHeadersSchema.parse({ host: 'api.test', cookie: 'a=b' })).toMatchObject({
      host: 'api.test',
      cookie: 'a=b',
    });
  });
});
