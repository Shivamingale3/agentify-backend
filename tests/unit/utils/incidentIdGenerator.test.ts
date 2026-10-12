import { describe, expect, it } from 'vitest';
import incidentIdGenerator from '#utils/incidentIdGenerator.js';

describe('incidentIdGenerator', () => {
  it('returns INC- followed by 10 Crockford base32 chars', () => {
    expect(incidentIdGenerator()).toMatch(/^INC-[0-9A-HJKMNP-TV-Z]{10}$/);
  });
});
