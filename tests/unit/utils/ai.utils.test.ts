import { describe, expect, it } from 'vitest';
import { parseAIResponse } from '#utils/ai.utils.js';

describe('parseAIResponse', () => {
  it('parses plain JSON', () => {
    expect(parseAIResponse<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });

  it('strips ```json fences and surrounding whitespace', () => {
    expect(parseAIResponse<{ a: number }>('\n```json\n{"a":1}\n```\n')).toEqual({ a: 1 });
  });

  it('strips bare ``` fences', () => {
    expect(parseAIResponse<number[]>('```[1,2]```')).toEqual([1, 2]);
  });

  it.each(['', 'not json', '```json\n{oops}\n```'])('throws a generic error for %j', (raw) => {
    expect(() => parseAIResponse(raw)).toThrow('Invalid AI response.');
  });
});
