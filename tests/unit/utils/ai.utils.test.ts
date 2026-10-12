import { describe, expect, it } from 'vitest';
import z from 'zod';
import { parseAIResponse } from '#utils/ai.utils.js';

const objectSchema = z.object({ a: z.number() });

describe('parseAIResponse', () => {
  it('parses plain JSON and infers the type from the schema', () => {
    const result = parseAIResponse('{"a":1}', objectSchema);
    expect(result).toEqual({ a: 1 });
  });

  it('strips ```json fences and surrounding whitespace', () => {
    expect(parseAIResponse('\n```json\n{"a":1}\n```\n', objectSchema)).toEqual({ a: 1 });
  });

  it('strips bare ``` fences', () => {
    expect(parseAIResponse('```[1,2]```', z.array(z.number()))).toEqual([1, 2]);
  });

  it.each(['', 'not json', '```json\n{oops}\n```'])('rejects non-JSON %j', (raw) => {
    expect(() => parseAIResponse(raw, objectSchema)).toThrow('Invalid AI response: not JSON.');
  });

  // Regression: the result used to be cast to T unchecked, so a wrong shape reached callers.
  it.each(['{"a":"1"}', '{}', '[1]', 'null'])(
    'rejects valid JSON with the wrong shape %j',
    (raw) => {
      expect(() => parseAIResponse(raw, objectSchema)).toThrow(
        'Invalid AI response: unexpected shape.',
      );
    },
  );
});
