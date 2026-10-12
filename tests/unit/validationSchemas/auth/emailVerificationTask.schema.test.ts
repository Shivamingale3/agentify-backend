import { describe, expect, it } from 'vitest';
import { emailVerificationTaskSchema } from '#validationSchemas/auth/emailVerificationTask.schema.js';

const valid = {
  token: 'tok',
  email: 'a@example.com',
  userId: 'user_1',
  validTill: '2026-01-01T00:00:00.000Z',
};

describe('emailVerificationTaskSchema', () => {
  it('accepts a valid task and strips unknown keys', () => {
    expect(emailVerificationTaskSchema.parse({ ...valid, extra: 1 })).toEqual(valid);
  });

  it('rejects an invalid email', () => {
    expect(emailVerificationTaskSchema.safeParse({ ...valid, email: 'nope' }).success).toBe(false);
  });

  it.each(['token', 'email', 'userId', 'validTill'] as const)('requires %s', (key) => {
    const { [key]: _omit, ...rest } = valid;
    const result = emailVerificationTaskSchema.safeParse(rest);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([key]);
  });

  it('rejects non-string fields', () => {
    expect(emailVerificationTaskSchema.safeParse({ ...valid, userId: 1 }).success).toBe(false);
  });
});
