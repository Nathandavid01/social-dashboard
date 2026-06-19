import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import {
  normalizeInstagramPost,
  normalizeFacebookPost,
  sortPostsByDate,
  summarizeReport,
  type ReportPost,
  type ReportSummary,
} from '@/lib/utils/client-report-core'
import { previousWindow, deltaPct } from '@/lib/utils/report-delta-core'
import { topContentType } from '@/lib/utils/report-insights-core'
import { buildDemographics, type Demographics } from '@/lib/utils/demographics-core'
import { parseBestTime, buildRecommendations, type Recommendation } from '@/lib/utils/action-plan-core'

const METRICOOL_BASE = 'https://app.metricool.com/api'

function numKey(o: unknown, k: string): number {
  const v = o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0
}

/** GET a Metricool endpoint that returns a JSON object (aggregations, demographics). */
async function fetchObj(
  userToken: string,
  userId: string,
  blogId: string,
  path: string,
  params: Record<string, string> = {},
): Promise<unknown> {
  const url = new URL(`${METRICOOL_BASE}/stats/${path}`)
  url.searchParams.set('userId', userId)
  url.searchParams.set('blogId', blogId)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  try {
    const res = await fetch(url.toString(), {
      headers: { 'X-Mc-Auth': userToken },
      signal: AbortSignal.timeout(7000),
    })
    if (!res.ok) return {}
    return await res.json()
  } catch {
    return {}
  }
}

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

async function fetchList(
  userToken: string,
  userId: string,
  blogId: string,
  path: string,
  start: string,
  end: string,
): Promise<unknown[]> {
  const url = new URL(`${METRICOOL_BASE}/stats/${path}`)
  url.searchParams.set('userId', userId)
  url.searchParams.set('blogId', blogId)
  url.searchParams.set('start', start)
  url.searchParams.set('end', end)
  try {
    const res = await fetch(url.toString(), {
      headers: { 'X-Mc-Auth': userToken },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const json = await res.json()
    return Array.isArray(json) ? json : []
  } catch {
    return []
  }
}

async function loadPosts(
  userToken: string,
  userId: string,
  blogId: string,
  start: string,
  end: string,
): Promise<ReportPost[]> {
  const [igPosts, igReels, fbPosts] = await Promise.all([
    fetchList(userToken, userId, blogId, 'instagram/posts', start, end),
    fetchList(userToken, userId, blogId, 'instagram/reels', start, end),
    fetchList(userToken, userId, blogId, 'facebook/posts', start, end),
  ])
  return sortPostsByDate([
    ...igPosts.map((p) => normalizeInstagramPost(p, 'post')),
    ...igReels.map((p) => normalizeInstagramPost(p, 'reel')),
    ...fbPosts.map((p) => normalizeFacebookPost(p)),
  ])
}

export interface ClientReport {
  client: { id: string; name: string; logoUrl: string | null }
  periodDays: number
  start: string
  end: string
  posts: ReportPost[]
  summary: ReportSummary
  /** Summary of the immediately-prior window, when comparison was requested. */
  previousSummary: ReportSummary | null
  /** Audience follower count (IG + FB), 0 when unavailable. */
  followers: number
  /** Audience demographics (IG-primary), null when unavailable. */
  demographics: Demographics | null
  /** Data-backed recommendations for the next period. */
  recommendations: Recommendation[]
  metricoolConfigured: boolean
}

/**
 * Per-client report: posts published in the window + the reach/impact they had.
 * Gated on metricool.read; client read via RLS, posts via the team Metricool
 * token (server-side only). With `compare`, also returns the prior window's KPIs.
 */
export async function getClientReport(
  clientId: string,
  periodDays = 30,
  opts: { compare?: boolean } = {},
): Promise<ClientReport | null> {
  await requirePermission('metricool.read')

  const days = [7, 30, 90].includes(periodDays) ? periodDays : 30
  const supabase = await createClient()
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, logo_url, metricool_blog_id')
    .eq('id', clientId)
    .maybeSingle()
  if (!client) return null

  const now = Date.now()
  const end = ymd(new Date(now))
  const start = ymd(new Date(now - days * 24 * 60 * 60 * 1000))
  const base = {
    client: { id: client.id as string, name: client.name as string, logoUrl: (client.logo_url as string) ?? null },
    periodDays: days,
    start,
    end,
  }

  const empty = {
    posts: [],
    summary: summarizeReport([]),
    previousSummary: null,
    followers: 0,
    demographics: null,
    recommendations: [],
  }
  const userToken = process.env.METRICOOL_TOKEN
  const userId = process.env.METRICOOL_USER_ID
  if (!client.metricool_blog_id || !userToken || !userId) {
    return { ...base, ...empty, metricoolConfigured: false }
  }

  const blogId = String(client.metricool_blog_id)
  // Posts + audience (followers, demographics) + best time, all in parallel.
  const [posts, igAgg, fbAgg, genderMap, ageMap, cityMap, bestTimeMap] = await Promise.all([
    loadPosts(userToken, userId, blogId, start, end),
    fetchObj(userToken, userId, blogId, 'aggregations/instagram', { start, end }),
    fetchObj(userToken, userId, blogId, 'aggregations/facebook', { start, end }),
    fetchObj(userToken, userId, blogId, 'gender/instagram'),
    fetchObj(userToken, userId, blogId, 'age/instagram'),
    fetchObj(userToken, userId, blogId, 'city/instagram'),
    fetchObj(userToken, userId, blogId, 'besttimes/instagram', { start, end }),
  ])

  let previousSummary: ReportSummary | null = null
  if (opts.compare) {
    const prev = previousWindow(days, now)
    const prevPosts = await loadPosts(userToken, userId, blogId, ymd(new Date(prev.start)), ymd(new Date(prev.end)))
    previousSummary = summarizeReport(prevPosts)
  }

  const summary = summarizeReport(posts)
  const followers = numKey(igAgg, 'Followers') + numKey(fbAgg, 'pageFollows')
  const demo = buildDemographics(genderMap, ageMap, cityMap)
  const recommendations = buildRecommendations({
    winningFormat: topContentType(posts) === '—' ? null : topContentType(posts),
    bestTime: parseBestTime(bestTimeMap),
    clicks: summary.clicks,
    saves: summary.saved,
    reachDeltaPct: previousSummary ? deltaPct(summary.reach, previousSummary.reach) : null,
    posts: summary.posts,
    periodDays: days,
  })

  return {
    ...base,
    posts,
    summary,
    previousSummary,
    followers,
    demographics: demo.hasData ? demo : null,
    recommendations,
    metricoolConfigured: true,
  }
}
