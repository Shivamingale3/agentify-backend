// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function parseAIResponse<T>(response: string): T {
  try {
    const cleaned = response
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error('Invalid AI response.');
  }
}
