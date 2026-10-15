import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerConfig } from '@/lib/metricool/post'
import { getScheduledPosts } from '@/lib/metricool/scheduler'
import { CADENCIA_TAG } from '@/lib/actions/cadencia-tag'
import { addDaysISO } from '@/lib/utils/deadlines'
import { toScheduledSlot, type ScheduledSlot } from './metricool-scheduled-core'

/** How far ahead the planner is read. Covers the profile calendar (14 d) with room. */
const HORIZON_DAYS = 28
/** Concurrent Metricool calls — same pace as the Cadencia sweep. */
const CHUNK = 6

export type PlannerByClient = Record<string, ScheduledSlot[]>

/**
 * Pending posts in each active client's Metricool planner, today → +28 days.
 * Service-level and the same for every viewer, so it runs with the admin client
 * and is shared through the Next data cache for 10 minutes (one Metricool call
 * per client per 10 min, not per visit). Cadence edits bust it (CADENCIA_TAG).
 *
 * Returns null when Metricool isn't configured, so the page can say the
 * scheduled numbers only come from the dashboard.
 */
export function loadPlannerSlots(today: string): Promise<PlannerByClient | null> {
  return unstable_cache(() => sweep(today), ['inventario-planner', 'v1', today], {
    revalidate: 600,
    tags: [CADENCIA_TAG],
  })()
}

async function sweep(today: string): Promise<PlannerByClient | null> {
  const supabase = createAdminClient()
  const base = getServerConfig()
  if (!supabase || !base) return null

  const { data, error } = await supabase
    .from('clients')
    .select('id, metricool_blog_id')
    .eq('status', 'active')
    .not('metricool_blog_id', 'is', null)
  if (error) return null

  const start = `${today}T00:00:00`
  const end = `${addDaysISO(today, HORIZON_DAYS)}T23:59:59`
  const rows = (data ?? []) as { id: string; metricool_blog_id: string }[]
  const out: PlannerByClient = {}
  for (let i = 0; i < rows.length; i += CHUNK) {
    await Promise.all(
      rows.slice(i, i + CHUNK).map(async (c) => {
        try {
          const posts = await getScheduledPosts({ ...base, blogId: String(c.metricool_blog_id) }, start, end)
          out[c.id] = posts.map((p) => toScheduledSlot(p, today)).filter((s): s is ScheduledSlot => !!s)
        } catch {
          // One client's Metricool failing just leaves its planner unknown.
        }
      }),
    )
  }
  return out
}
