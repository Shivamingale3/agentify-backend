import { describe, expect, it, vi } from 'vitest';
import { logger, morganStream } from '#utils/logger.js';

describe('logger', () => {
  it('is silent under APP_ENV=test unless LOG_IN_TESTS is set', () => {
    expect(logger.silent).toBe(!process.env['LOG_IN_TESTS']);
  });
});

describe('morganStream.write', () => {
  it('logs the morgan line at info level without the trailing newline', () => {
    const info = vi.spyOn(logger, 'info');
    morganStream.write('GET / 200 1.2 ms\n');
    expect(info).toHaveBeenCalledWith('GET / 200 1.2 ms');
  });
});
