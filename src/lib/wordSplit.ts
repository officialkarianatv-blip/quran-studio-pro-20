/**
 * Split Arabic (or any) row text into surface words.
 * Whitespace-delimited, empty tokens dropped. Order preserved.
 */
export function splitArabicWords(text: string): string[] {
  if (!text) return [];
  return text.split(/\s+/).filter((w) => w.length > 0);
}
