import { registerSchema } from '@/auth/dto/register.dto.js';

const minimal = { email: 'a@example.com', password: 'Passw0rd!' };

function messagesFor(input: unknown): string[] {
  const result = registerSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe('registerSchema', () => {
  it('accepts just email + password', () => {
    expect(registerSchema.parse(minimal)).toEqual(minimal);
  });

  it('accepts a full valid payload', () => {
    const full = {
      ...minimal,
      firstName: 'Ada',
      lastName: 'Lovelace',
      countryCode: '+91',
      mobile: '9876543210',
    };
    expect(registerSchema.parse(full)).toEqual(full);
  });

  it('accepts null for optional profile fields', () => {
    const nulls = { ...minimal, firstName: null, lastName: null, countryCode: null, mobile: null };
    expect(registerSchema.parse(nulls)).toEqual(nulls);
  });

  describe('email', () => {
    it.each([undefined, '', 'not-an-email'])('rejects %j', (email) => {
      expect(messagesFor({ ...minimal, email }).length).toBeGreaterThan(0);
    });

    it('reports an invalid address', () => {
      expect(messagesFor({ ...minimal, email: 'nope' })).toContain('Invalid email address');
    });

    it('trims and lowercases the address', () => {
      expect(registerSchema.parse({ ...minimal, email: '  Jane@Example.COM ' }).email).toBe(
        'jane@example.com',
      );
    });

    it('reports a whitespace-only address as required', () => {
      expect(messagesFor({ ...minimal, email: '   ' })).toContain('Email is required');
    });
  });

  describe('password', () => {
    it.each(['Aa1!aaaa', 'Aa1!' + 'a'.repeat(68)])('accepts boundary length %j', (password) => {
      expect(registerSchema.safeParse({ ...minimal, password }).success).toBe(true);
    });

    it.each(['Passw0rd-', 'Passw0rd.', 'Pass w0rd', 'Aa1!aaaaaaaaaaaaa'])(
      'accepts %j',
      (password) => {
        expect(registerSchema.safeParse({ ...minimal, password }).success).toBe(true);
      },
    );

    it.each([
      ['too short', 'Aa1!aaa'],
      ['too long (73 bytes)', 'Aa1!' + 'a'.repeat(69)],
      ['too long in bytes (multi-byte chars)', 'Aa1!' + 'é'.repeat(35)],
      ['no uppercase', 'passw0rd!'],
      ['no lowercase', 'PASSW0RD!'],
      ['no digit', 'Password!'],
      ['no special', 'Passw0rdd'],
      ['empty', ''],
    ])('rejects %s', (_label, password) => {
      expect(messagesFor({ ...minimal, password })).toEqual(
        expect.arrayContaining([expect.stringMatching(/^Password/)]),
      );
    });

    it('is required', () => {
      expect(registerSchema.safeParse({ email: minimal.email }).success).toBe(false);
    });
  });

  describe.each(['firstName', 'lastName'] as const)('%s', (field) => {
    it.each(['Al', 'a'.repeat(50)])('accepts length boundary %j', (value) => {
      expect(registerSchema.safeParse({ ...minimal, [field]: value }).success).toBe(true);
    });

    it('rejects shorter than 2', () => {
      expect(messagesFor({ ...minimal, [field]: 'A' })[0]).toMatch(/at least 2/);
    });

    it('rejects longer than 50', () => {
      expect(messagesFor({ ...minimal, [field]: 'a'.repeat(51) })[0]).toMatch(/at most 50/);
    });
  });

  describe('countryCode', () => {
    it.each(['+1', '+91', '+999'])('accepts %j', (countryCode) => {
      expect(registerSchema.safeParse({ ...minimal, countryCode }).success).toBe(true);
    });

    it.each(['91', '+', '+1234', '+9a', ' +91'])('rejects %j', (countryCode) => {
      expect(messagesFor({ ...minimal, countryCode })).toEqual([
        'Country code must be in format +XX (e.g. +91)',
      ]);
    });
  });

  describe('mobile', () => {
    it.each(['1234', '1'.repeat(15)])('accepts length boundary %j', (mobile) => {
      expect(registerSchema.safeParse({ ...minimal, mobile }).success).toBe(true);
    });

    it('rejects fewer than 4 digits', () => {
      expect(messagesFor({ ...minimal, mobile: '123' })).toContain(
        'Mobile number must be at least 4 digits',
      );
    });

    it('rejects more than 15 digits', () => {
      expect(messagesFor({ ...minimal, mobile: '1'.repeat(16) })).toContain(
        'Mobile number must be at most 15 digits',
      );
    });

    it('rejects non-digits', () => {
      expect(messagesFor({ ...minimal, mobile: '12-345' })).toContain(
        'Mobile number must contain only digits',
      );
    });
  });
});
