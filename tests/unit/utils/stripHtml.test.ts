import { describe, expect, it } from 'vitest';
import stripHtml from '#utils/stripHtml.js';

describe('stripHtml', () => {
  it('removes tags and trims', () => {
    expect(stripHtml('  <p>Hello <b>world</b></p>\n')).toBe('Hello world');
  });

  it('decodes the common entities', () => {
    expect(stripHtml('a&nbsp;b &amp; &lt;c&gt; &quot;d&quot; &#39;e&#39;')).toBe(
      'a b & <c> "d" \'e\'',
    );
  });

  it('returns an empty string for markup only', () => {
    expect(stripHtml('<br/><div></div>')).toBe('');
  });

  // Regression: "&amp;" was decoded first, so double-encoded text was decoded twice.
  it('decodes each entity once, never double-decoding', () => {
    expect(stripHtml('&amp;lt;script&amp;gt;')).toBe('&lt;script&gt;');
    expect(stripHtml('&amp;amp;')).toBe('&amp;');
  });
});
