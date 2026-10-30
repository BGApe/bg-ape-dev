/** First sentences of an answer, used as the collapsed topic preview. */
export function previewSentences(text: string, count = 2): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length === 0) return '';
  const sentences = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [cleaned];
  const picked = sentences
    .slice(0, count)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)
    .join(' ');
  return picked.length > 0 ? picked : cleaned;
}

/** Titles from a numbered strategy list, such as "1. Big Money". */
export function strategyTitles(text: string): string[] {
  const titles: string[] = [];
  for (const line of text.split('\n')) {
    const match = /^\s*\d+[.)]\s+(.+?)\s*$/.exec(line.trim());
    const title = match?.[1]?.replace(/\*\*/g, '').trim();
    if (title === undefined || title.length === 0) continue;
    titles.push(title);
    if (titles.length === 3) break;
  }
  return titles;
}

export function assistantText(contents: readonly string[]): string {
  return contents
    .map((content) => content.trim())
    .filter((content) => content.length > 0)
    .join('\n\n');
}
