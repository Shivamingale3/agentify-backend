import { describe, expect, it } from 'vitest';
import { ApiResponse } from '#lib/apiResponse.js';

describe('ApiResponse', () => {
  it('success() builds a successful response', () => {
    const response = ApiResponse.success('ok', { id: 1 });
    expect(response).toBeInstanceOf(ApiResponse);
    expect(response).toEqual({ success: true, message: 'ok', data: { id: 1 } });
  });

  it('error() builds a failed response', () => {
    expect(ApiResponse.error('bad', null)).toEqual({ success: false, message: 'bad', data: null });
  });

  it('serialises to the documented JSON shape', () => {
    expect(JSON.parse(JSON.stringify(ApiResponse.success('ok', [1])))).toEqual({
      success: true,
      message: 'ok',
      data: [1],
    });
  });
});
