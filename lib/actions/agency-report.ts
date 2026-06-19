import 'server-only'
import { unstable_cache } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requirePermission } from '@/lib/auth/server'
import {
  aggregateClientMetrics,
  rankByReach,
  agencyTotals,
  type AgencyRow,
  type AgencyTotals,
} from '@/lib/utils/agency-report-core'

// Service role (cookie-free) so the heavy compute can be cached across users —
// the agency overview is the same for everyone who can see it.
function admin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

const METRICOOL_BASE = 'https://app.metricool.com/api'

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

async function aggregation(
  userToken: string,
  userId: string,
  blogId: string,
  network: string,
  start: string,
  end: string,
): Promise<unknown> {
  const url = new URL(`${METRICOOL_BASE}/stats/aggregations/${network}`)
  url.searchParams.set('userId', userId)
  url.searchParams.set('blogId', blogId)
  url.searchParams.set('start', start)
  url.searchParams.set('end', end)
  try {
    const res = await fetch(url.toString(), {
      headers: { 'X-Mc-Auth': userToken },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return {}
    return await res.json()
  } catch {
    return {}
  }
}

export interface AgencyReport {
  periodDays: number
  start: string
  end: string
  rows: AgencyRow[]
  totals: AgencyTotals
  metricoolConfigured: boolean
}

async function computeAgencyReport(days: number): Promise<AgencyReport> {
  const supabase = admin()
  const { data } = await supabase
    .from('clients')
    .select('id, name, metricool_blog_id')
    .not('metricool_blog_id', 'is', null)
    .order('name')
  const clients = (data ?? []) as { id: string; name: string; metricool_blog_id: unknown }[]

  const now = Date.now()
  const end = ymd(new Date(now))
  const start = ymd(new Date(now - days * 24 * 60 * 60 * 1000))
  const base = { periodDays: days, start, end }

  const userToken = process.env.METRICOOL_TOKEN
  const userId = process.env.METRICOOL_USER_ID
  if (!userToken || !userId || clients.length === 0) {
    return { ...base, rows: [], totals: agencyTotals([]), metricoolConfigured: !!(userToken && userId) }
  }

  const rows: AgencyRow[] = await Promise.all(
    clients.map(async (c) => {
      const blogId = String(c.metricool_blog_id)
      const [ig, fb] = await Promise.all([
        aggregation(userToken, userId, blogId, 'instagram', start, end),
        aggregation(userToken, userId, blogId, 'facebook', start, end),
      ])
      const m = aggregateClientMetrics(ig, fb)
      return { id: c.id, name: c.name, reach: m.reach, impressions: m.impressions }
    }),
  )

  const ranked = rankByReach(rows)
  return { ...base, rows: ranked, totals: agencyTotals(ranked), metricoolConfigured: true }
}

// Cached per-period for 1h so opening the report is instant and doesn't re-hit
// ~2×N Metricool endpoints on every view.
const cachedAgencyReport = unstable_cache(computeAgencyReport, ['agency-report-v1'], { revalidate: 3600 })

/** Agency-wide overview: every client ranked by reach + impressions, over the window. */
export async function getAgencyReport(periodDays = 30): Promise<AgencyReport> {
  await requirePermission('metricool.read')
  const days = [7, 30, 90].includes(periodDays) ? periodDays : 30
  return cachedAgencyReport(days)
}
