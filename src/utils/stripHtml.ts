const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

export default function stripHtml(html: string): string {
  return (
    html
      .replace(/<[^>]*>/g, '')
      // One pass, so decoded output is never decoded again: "&amp;lt;" becomes "&lt;", not "<".
      .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity)
      .trim()
  );
}
