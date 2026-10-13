import { describe, expect, it } from 'vitest';
import loginSchema from '#validationSchemas/auth/login.schema.js';

const password = 'Passw0rd!';

describe('loginSchema', () => {
  describe('email', () => {
    it('trims and lowercases the address', () => {
      expect(loginSchema.parse({ email: '  Jane@Example.COM ', password }).email).toBe(
        'jane@example.com',
      );
    });

    it.each([undefined, '', 'not-an-email'])('rejects %j', (email) => {
      expect(loginSchema.safeParse({ email, password }).success).toBe(false);
    });
  });
});
