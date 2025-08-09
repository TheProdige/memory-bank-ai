// Lightweight, local prompt preprocessor to reduce payload size
// - Collapses whitespace
// - Removes duplicate lines
// - Keeps a balanced head/tail window within a max character budget

export function compressText(input: string, maxChars = 4000): string {
  if (!input) return '';
  const collapsed = input.replace(/\r/g, '').split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  // Deduplicate consecutive lines
  const dedup: string[] = [];
  for (const line of collapsed) {
    if (dedup.length === 0 || dedup[dedup.length - 1] !== line) dedup.push(line);
  }
  const joined = dedup.join('\n');
  if (joined.length <= maxChars) return joined;

  const head = joined.slice(0, Math.floor(maxChars * 0.7));
  const tail = joined.slice(-Math.floor(maxChars * 0.3));
  return `${head}\n...\n${tail}`;
}
