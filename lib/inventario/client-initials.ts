const CONNECTORS = new Set(['y', 'de', 'del', 'la', 'el', 'los', 'las', '&', 'and'])

/** Two-letter monogram for a client with no logo ("La Guira" → "LG"). */
export function clientInitials(name: string): string {
  const words = name
    .split(/[\s.]+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
  if (words.length === 0) return '?'
  // The first word always counts ("La Guira" → L); connectors only skip after it.
  const meaningful = [words[0], ...words.slice(1).filter((w) => !CONNECTORS.has(w.toLowerCase()))]
  if (meaningful.length === 1) return meaningful[0].slice(0, 2).toUpperCase()
  return (meaningful[0][0] + meaningful[1][0]).toUpperCase()
}
