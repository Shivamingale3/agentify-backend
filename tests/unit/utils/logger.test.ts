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

describe('logger format', () => {
  // Regression: without splat(), messages were logged with a literal "%s".
  it('fills %s placeholders from the extra arguments', () => {
    const info = logger.format.transform({
      level: 'info',
      message: 'Job %s removed %d tasks',
      [Symbol.for('splat')]: ['job_1', 3],
    });
    expect(info).toMatchObject({ message: 'Job job_1 removed 3 tasks' });
  });
});
