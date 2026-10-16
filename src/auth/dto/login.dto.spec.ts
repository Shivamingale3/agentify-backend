import { loginSchema } from '@/auth/dto/login.dto.js';

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

  describe('password', () => {
    // Regression: login enforced the register strength rules, leaking the policy.
    it.each(['abc', 'password', 'a'.repeat(128)])('accepts any non-empty password %j', (pw) => {
      expect(loginSchema.safeParse({ email: 'a@example.com', password: pw }).success).toBe(true);
    });

    it.each([undefined, '', 'a'.repeat(129)])('rejects %j', (pw) => {
      expect(loginSchema.safeParse({ email: 'a@example.com', password: pw }).success).toBe(false);
    });
  });
});
