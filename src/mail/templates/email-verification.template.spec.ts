import {
  emailVerificationTemplate,
  escapeHtml,
} from '@/mail/templates/email-verification.template.js';
import { describe, expect, it } from 'vitest';

describe('escapeHtml', () => {
  it('escapes every HTML-significant character', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
  });

  it('leaves plain text untouched', () => {
    expect(escapeHtml('jane@example.com')).toBe('jane@example.com');
  });
});

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

  // Regression: values were interpolated raw, allowing markup injection into the email.
  it('escapes the email and link so they cannot inject markup', () => {
    const injected = emailVerificationTemplate(
      "o'hara&<b>@example.com",
      'https://app.test/verify?token=a"><script>x</script>&b=1',
    );
    expect(injected).toContain('<strong>o&#39;hara&amp;&lt;b&gt;@example.com</strong>');
    expect(injected).toContain(
      'href="https://app.test/verify?token=a&quot;&gt;&lt;script&gt;x&lt;/script&gt;&amp;b=1"',
    );
    expect(injected).not.toContain('<script>');
  });
});
