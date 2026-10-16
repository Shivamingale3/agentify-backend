import { deviceHeadersSchema } from '@/auth/decorators/device-headers.decorator.js';

describe('deviceHeadersSchema', () => {
  it('keeps valid labels, trimmed', () => {
    expect(
      deviceHeadersSchema.parse({ 'x-client-name': '  Chrome ', 'x-client-type': 'web' }),
    ).toEqual({ clientName: 'Chrome', clientType: 'web' });
  });

  // Regression: values had no bounds, so any size went into sessions and Redis.
  it.each([['x'.repeat(101)], [''], ['   ']])('drops %j instead of failing', (value) => {
    expect(deviceHeadersSchema.parse({ 'x-client-name': value }).clientName).toBeUndefined();
  });

  it('ignores every other header', () => {
    expect(deviceHeadersSchema.parse({ host: 'api.test', cookie: 'a=b' })).toEqual({
      clientName: undefined,
      clientType: undefined,
    });
  });
});
