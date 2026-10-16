import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter.js';
import { ConflictException, type ArgumentsHost } from '@nestjs/common';

// Runs the filter against a fake HTTP context and returns what it sent.
function run(exception: unknown): { status: number; body: unknown } {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ method: 'GET', originalUrl: '/api/test' }),
      getResponse: () => res,
    }),
  } as unknown as ArgumentsHost;

  new AllExceptionsFilter().catch(exception, host);
  return { status: res.status.mock.calls[0]?.[0] as number, body: res.json.mock.calls[0]?.[0] };
}

const named = (name: string): Error => Object.assign(new Error('boom'), { name });

describe('AllExceptionsFilter', () => {
  it('passes Nest HTTP exceptions through with their status and message', () => {
    expect(run(new ConflictException('Email taken'))).toEqual({
      status: 409,
      body: { success: false, message: 'Email taken' },
    });
  });

  it('maps a Postgres unique violation to 409', () => {
    const error = Object.assign(new Error('dup'), { kind: 'sql_query', sqlState: '23505' });
    expect(run(error).status).toBe(409);
  });

  it('maps a queue Redis outage to 503', () => {
    expect(run(named('MaxRetriesPerRequestError'))).toEqual({
      status: 503,
      body: { success: false, message: 'Service temporarily unavailable, please try again' },
    });
  });

  it('hides unknown errors behind a generic 500', () => {
    expect(run(new Error('secret detail'))).toEqual({
      status: 500,
      body: { success: false, message: 'Internal Server Error' },
    });
  });
});
