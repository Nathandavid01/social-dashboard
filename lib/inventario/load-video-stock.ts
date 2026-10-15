import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getMetricoolPicturesByBlogId } from '@/lib/actions/client-pictures'
import { proxiedClientLogo } from './client-logo-url'
import { cadenceFormats } from './cadence-formats'
import { loadPlannerSlots } from './load-scheduled'
import { todayISOInTimeZone } from '@/lib/utils/deadlines'
import { POST_TZ } from '@/lib/utils/idea-lab-send-core'
import { buildVideoStock, type StockClient, type StockIdea, type VideoStock } from './video-stock-core'

/** PostgREST caps a response at 1000 rows; page through so big agencies are not cut off. */
const PAGE = 1000

const IDEA_COLUMNS =
  'id, client_id, status, content_type, published_at, manual_posted_status, metricool_post_id, posted_at, publish_date, ' +
  // Always the idea→videos FK (CLAUDE.md: a bare embed hits PGRST201).
  'videos:content_idea_videos!content_idea_videos_idea_id_fkey(kind, status, uploaded_at)'

/** Metricool profile pictures change rarely; don't hit their API on every visit. */
export const metricoolPictures = unstable_cache(getMetricoolPicturesByBlogId, ['inventario-metricool-pictures'], {
  revalidate: 3600,
})

/**
 * Server-only loader for /inventario. Reads active clients + every non-discarded
 * idea with its video files, then hands them to the pure core.
 * Returns null on a read error so the page can say so instead of showing zeros.
 */
export async function loadVideoStock(): Promise<VideoStock | null> {
  const supabase = await createClient()

  const today = todayISOInTimeZone(POST_TZ)
  const [{ data: clients, error: clientsError }, pictures, { data: schedules }, planner] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, posting_days, posting_schedule, logo_url, metricool_blog_id')
      .eq('status', 'active')
      .order('name'),
    metricoolPictures().catch(() => ({}) as Record<string, string>),
    // Per-day reel/post plan; a read error only loses the format split, not the page.
    supabase.from('production_schedules').select('client_id, day_of_week, content_type'),
    // Scheduled posts live in the Metricool planner, hand-made ones included.
    loadPlannerSlots(today).catch(() => null),
  ])
  if (clientsError) return null

  const clientIds = (clients ?? []).map((c) => c.id)
  const ideas: StockIdea[] = []
  // Keyset paging: offsets would skip or repeat a row if an idea changes mid-load.
  // Published history can never be "left", so the database drops it up front.
  let lastId: string | null = null
  while (clientIds.length > 0) {
    let query = supabase
      .from('content_ideas')
      .select(IDEA_COLUMNS)
      .in('client_id', clientIds)
      .not('status', 'in', '(descartada,publicada)')
      .is('published_at', null)
      .order('id')
      .limit(PAGE)
    if (lastId) query = query.gt('id', lastId)
    const { data, error } = await query
    if (error) return null
    const rows = (data ?? []) as unknown as StockIdea[]
    ideas.push(...rows)
    if (rows.length < PAGE) break
    lastId = rows[rows.length - 1].id
  }

  const stockClients: StockClient[] = (clients ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    posting_days: c.posting_days,
    logoUrl: proxiedClientLogo(c, pictures),
    formats: Object.fromEntries(
      cadenceFormats(
        c.posting_days,
        c.posting_schedule as Record<string, string> | null,
        (schedules ?? []).filter((r) => r.client_id === c.id),
      ),
    ),
    scheduled: planner?.[c.id] ?? [],
  }))
  return { ...buildVideoStock(stockClients, ideas, today), plannerAvailable: planner !== null }
}
