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
import { previousWindow } from '@/lib/utils/report-delta-core'

const METRICOOL_BASE = 'https://app.metricool.com/api'

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

  const userToken = process.env.METRICOOL_TOKEN
  const userId = process.env.METRICOOL_USER_ID
  if (!client.metricool_blog_id || !userToken || !userId) {
    return { ...base, posts: [], summary: summarizeReport([]), previousSummary: null, metricoolConfigured: false }
  }

  const blogId = String(client.metricool_blog_id)
  const posts = await loadPosts(userToken, userId, blogId, start, end)

  let previousSummary: ReportSummary | null = null
  if (opts.compare) {
    const prev = previousWindow(days, now)
    const prevPosts = await loadPosts(userToken, userId, blogId, ymd(new Date(prev.start)), ymd(new Date(prev.end)))
    previousSummary = summarizeReport(prevPosts)
  }

  return { ...base, posts, summary: summarizeReport(posts), previousSummary, metricoolConfigured: true }
}
