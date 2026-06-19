/**
 * Pure helpers to turn Metricool's per-post stats (/stats/{instagram,facebook}/…)
 * into a normalized client report. No network here so it's unit-testable; the
 * server action feeds it the raw arrays.
 */

export type ReportNetwork = 'instagram' | 'facebook'

export interface ReportPost {
  network: ReportNetwork
  type: string // 'post' | 'reel' | etc.
  timestamp: number // epoch ms
  url: string
  thumbnail: string | null
  content: string
  reach: number
  impressions: number
  likes: number
  comments: number
  shares: number
  saved: number
  views: number
  engagement: number
  clicks: number
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0
}
function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}
function get(o: unknown, k: string): unknown {
  return o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined
}

export function normalizeInstagramPost(raw: unknown, kind: 'post' | 'reel'): ReportPost {
  const likes = num(get(raw, 'likes'))
  const comments = num(get(raw, 'comments'))
  const shares = num(get(raw, 'shares'))
  const saved = num(get(raw, 'saved'))
  return {
    network: 'instagram',
    type: kind,
    timestamp: num(get(raw, 'timestamp')),
    url: str(get(raw, 'url')),
    thumbnail: str(get(raw, 'imageUrl')) || null,
    content: str(get(raw, 'content')),
    reach: num(get(raw, 'reach')),
    impressions: num(get(raw, 'impressions')),
    likes,
    comments,
    shares,
    saved,
    views: num(get(raw, 'views')) || num(get(raw, 'videoViews')),
    engagement: num(get(raw, 'interactions')) || likes + comments + shares + saved,
    clicks: num(get(raw, 'clicks')),
  }
}

export function normalizeFacebookPost(raw: unknown): ReportPost {
  const likes = num(get(raw, 'reactions')) || num(get(raw, 'like'))
  const comments = num(get(raw, 'comments'))
  const shares = num(get(raw, 'shares'))
  return {
    network: 'facebook',
    type: str(get(raw, 'type')) || 'post',
    timestamp: num(get(raw, 'timestamp')),
    url: str(get(raw, 'permalinkUrl')) || str(get(raw, 'link')),
    thumbnail: str(get(raw, 'picture')) || null,
    content: str(get(raw, 'text')),
    reach: num(get(raw, 'impressionsUnique')), // FB true unique reach
    impressions: num(get(raw, 'impressions')),
    likes,
    comments,
    shares,
    saved: 0,
    views: num(get(raw, 'videoViews')),
    engagement: num(get(raw, 'engagement')) || likes + comments + shares,
    clicks: num(get(raw, 'clicks')) || num(get(raw, 'linkclicks')),
  }
}

export function sortPostsByDate(posts: ReportPost[]): ReportPost[] {
  return [...posts].sort((a, b) => b.timestamp - a.timestamp)
}

export interface ReportSummary {
  posts: number
  reach: number
  impressions: number
  engagement: number
  views: number
  saved: number
  clicks: number
  byNetwork: { instagram: number; facebook: number }
  /** engagement / reach, 0..1; 0 when no reach. */
  engagementRate: number
  /** index of the highest-reach post in the given array, or -1. */
  topPostIndex: number
}

export function summarizeReport(posts: ReportPost[]): ReportSummary {
  let reach = 0
  let impressions = 0
  let engagement = 0
  let views = 0
  let saved = 0
  let clicks = 0
  let instagram = 0
  let facebook = 0
  let topPostIndex = -1
  let topReach = -1
  posts.forEach((p, i) => {
    reach += p.reach
    impressions += p.impressions
    engagement += p.engagement
    views += p.views
    saved += p.saved
    clicks += p.clicks
    if (p.network === 'instagram') instagram += 1
    else facebook += 1
    if (p.reach > topReach) {
      topReach = p.reach
      topPostIndex = i
    }
  })
  return {
    posts: posts.length,
    reach,
    impressions,
    engagement,
    views,
    saved,
    clicks,
    byNetwork: { instagram, facebook },
    engagementRate: reach > 0 ? engagement / reach : 0,
    topPostIndex: posts.length ? topPostIndex : -1,
  }
}

/** Compact number for KPI display: 9_636_238 → "9.6M", 12500 → "12.5K". */
export function formatCompact(value: number): string {
  if (value < 1000) return String(value)
  if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}K`.replace('.0', '')
  return `${(value / 1_000_000).toFixed(1)}M`.replace('.0', '')
}
