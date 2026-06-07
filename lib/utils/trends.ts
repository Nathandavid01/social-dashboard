/**
 * Pure helpers for working with social-media trend data.
 *
 * Trend data feeds the AI idea generator (see /api/generate-ideas). Sources are
 * intentionally pluggable: today we parse Google Trends' public "trending now"
 * RSS feed (free, filterable by country). A live TikTok Creative Center feed is
 * a tracked follow-up (docs/TODO.md) — when it lands it produces the same
 * TrendItem shape and flows through the same prompt formatter below.
 *
 * Keep this file free of server-only imports so it can be unit tested and reused
 * from client components.
 */

export interface TrendItem {
  /** The trend / search term / topic. */
  title: string
  /** Approximate traffic blurb when the source provides one, e.g. "20,000+". */
  traffic?: string
  /** Where the trend came from — lets the UI badge mixed sources. */
  source: 'google' | 'tiktok' | 'manual'
}

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim()
}

function firstTag(block: string, tag: string): string | undefined {
  // Tags can be namespaced (ht:approx_traffic) — escape the colon for the regex.
  const re = new RegExp(`<${tag.replace(':', '\\:')}[^>]*>([\\s\\S]*?)</${tag.replace(':', '\\:')}>`, 'i')
  const m = block.match(re)
  if (!m) return undefined
  const v = decodeEntities(m[1])
  return v.length > 0 ? v : undefined
}

/**
 * Parse Google Trends' "trending now" RSS into a clean trend list.
 * Tolerant of CDATA, HTML entities, and the `ht:` namespace; returns [] for
 * empty / malformed input rather than throwing, so a flaky feed never breaks
 * the idea generator.
 */
export function parseTrendingRss(xml: string): TrendItem[] {
  if (!xml || typeof xml !== 'string') return []
  const items: TrendItem[] = []
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi
  let match: RegExpExecArray | null
  while ((match = itemRe.exec(xml)) !== null) {
    const block = match[1]
    const title = firstTag(block, 'title')
    if (!title) continue
    const traffic = firstTag(block, 'ht:approx_traffic')
    items.push({ title, traffic, source: 'google' })
  }
  return items
}

/**
 * Render a trend list into a compact block for the AI prompt. Returns '' when
 * there are no trends so callers can cleanly omit the section.
 */
export function formatTrendsForPrompt(trends: TrendItem[]): string {
  if (!trends || trends.length === 0) return ''
  return trends
    .map((t) => (t.traffic ? `- ${t.title} (${t.traffic})` : `- ${t.title}`))
    .join('\n')
}
