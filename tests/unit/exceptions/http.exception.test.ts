import { describe, expect, it } from 'vitest';
import { HttpException } from '#exceptions/http.exception.js';

describe('HttpException', () => {
  it('is an Error carrying the status code and message', () => {
    const error = new HttpException(404, 'Not found');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(HttpException);
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe('Not found');
    expect(error.stack).toBeDefined();
  });
});
