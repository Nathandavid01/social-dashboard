import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import {
  aggregateClientMetrics,
  rankByReach,
  agencyTotals,
  type AgencyRow,
  type AgencyTotals,
} from '@/lib/utils/agency-report-core'

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

/** Agency-wide overview: every client ranked by reach + impressions, over the window. */
export async function getAgencyReport(periodDays = 30): Promise<AgencyReport> {
  await requirePermission('metricool.read')

  const days = [7, 30, 90].includes(periodDays) ? periodDays : 30
  const supabase = await createClient()
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
