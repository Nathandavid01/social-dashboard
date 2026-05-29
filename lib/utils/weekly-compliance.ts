import { createClient } from '@/lib/supabase/server'
import {
  deriveComplianceStatus,
  type ClientWeeklyCompliance,
  type WeeklyComplianceSummary,
} from './weekly-compliance-types'

export type { WeeklyComplianceSummary, ClientWeeklyCompliance } from './weekly-compliance-types'

/** Current week, Monday→Sunday, as YYYY-MM-DD, plus days elapsed (1..7). */
function weekRangeMon(ref: Date = new Date()): { start: string; end: string; daysElapsed: number } {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  const offset = (d.getDay() + 6) % 7 // 0 = Monday
  const start = new Date(d)
  start.setDate(d.getDate() - offset)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const fmt = (x: Date) => x.toISOString().slice(0, 10)
  return { start: fmt(start), end: fmt(end), daysElapsed: offset + 1 }
}

/**
 * Per-client weekly posting compliance: how many posts the contract requires
 * (weekly_post_quota) vs. how many were actually published this week
 * (content_ideas with status 'publicada' and published_at within the week).
 *
 * Returns ALL active clients; the UI separates those without a quota set.
 * Status is derived on read — never stored.
 */
export async function getWeeklyComplianceByClient(): Promise<WeeklyComplianceSummary> {
  const supabase = await createClient()
  const { start, end, daysElapsed } = weekRangeMon()

  const [{ data: clients }, { data: published }] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, weekly_post_quota')
      .eq('status', 'active')
      .order('name', { ascending: true }),
    supabase
      .from('content_ideas')
      .select('client_id')
      .eq('status', 'publicada')
      .gte('published_at', `${start}T00:00:00`)
      .lte('published_at', `${end}T23:59:59.999`),
  ])

  const publishedByClient = new Map<string, number>()
  for (const row of published ?? []) {
    const cid = row.client_id as string
    publishedByClient.set(cid, (publishedByClient.get(cid) ?? 0) + 1)
  }

  const rows: ClientWeeklyCompliance[] = (clients ?? []).map((c) => {
    const quota = (c.weekly_post_quota as number | null) ?? null
    const count = publishedByClient.get(c.id as string) ?? 0
    return {
      clientId: c.id as string,
      clientName: c.name as string,
      quota,
      published: count,
      status: deriveComplianceStatus(quota, count, daysElapsed),
    }
  })

  let totalQuota = 0
  let totalPublished = 0
  for (const r of rows) {
    if (r.quota !== null) totalQuota += r.quota
    totalPublished += r.published
  }

  return { weekStart: start, weekEnd: end, daysElapsed, clients: rows, totalQuota, totalPublished }
}
