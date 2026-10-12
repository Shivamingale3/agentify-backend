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
});
