import { describe, expect, it } from 'vitest';
import { emailVerificationTemplate } from '#utils/emailTemplates.js';

describe('emailVerificationTemplate', () => {
  const html = emailVerificationTemplate('a@example.com', 'https://app.test/verify?token=abc');

  it('renders a full HTML document', () => {
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('</html>');
  });

  it('greets the recipient and links to the verification URL', () => {
    expect(html).toContain('<strong>a@example.com</strong>');
    expect(html).toContain('href="https://app.test/verify?token=abc"');
  });

  it('includes the current year in the footer', () => {
    expect(html).toContain(`&copy; ${String(new Date().getFullYear())} Agentify`);
  });
});
