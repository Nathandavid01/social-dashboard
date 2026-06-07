/**
 * Live trend sources for the Idea Lab. Server-only (network fetch).
 *
 * Currently wired: Google Trends "trending now" RSS, filtered to a country
 * (default Puerto Rico). It's a free, public feed with no API key. It is NOT an
 * official, contract-stable API, so every call is defensive — on any failure we
 * return [] and the Idea Lab falls back to manually-typed trends. A live TikTok
 * Creative Center feed (trending audio/hashtags) is a tracked follow-up in
 * docs/TODO.md; it will return the same TrendItem shape.
 */
import { parseTrendingRss, type TrendItem } from '@/lib/utils/trends'

/** Default geo — NMedia's clients are Puerto Rico based. */
export const DEFAULT_TRENDS_GEO = 'PR'

/**
 * Fetch the current Google Trends "trending now" list for a country.
 * Never throws — returns [] on network error, non-200, or parse failure.
 */
export async function fetchGoogleTrends(geo: string = DEFAULT_TRENDS_GEO): Promise<TrendItem[]> {
  const safeGeo = /^[A-Za-z]{2}$/.test(geo) ? geo.toUpperCase() : DEFAULT_TRENDS_GEO
  const url = `https://trends.google.com/trending/rss?geo=${safeGeo}`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NMediaDashboard/1.0)' },
      // Trends move slowly; cache for 30 min to avoid hammering the feed.
      next: { revalidate: 1800 },
    })
    if (!res.ok) return []
    const xml = await res.text()
    return parseTrendingRss(xml).slice(0, 15)
  } catch {
    return []
  }
}
