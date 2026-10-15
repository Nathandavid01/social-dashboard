import { createClient } from '@/lib/supabase/server'
import { todayISOInTimeZone } from '@/lib/utils/deadlines'
import { POST_TZ } from '@/lib/utils/idea-lab-send-core'
import { buildVideoStock, type StockClient, type StockIdea, type VideoStock } from './video-stock-core'

/** PostgREST caps a response at 1000 rows; page through so big agencies are not cut off. */
const PAGE = 1000

const IDEA_COLUMNS =
  'id, client_id, status, published_at, manual_posted_status, metricool_post_id, posted_at, publish_date, ' +
  // Always the idea→videos FK (CLAUDE.md: a bare embed hits PGRST201).
  'videos:content_idea_videos!content_idea_videos_idea_id_fkey(kind, status, uploaded_at)'

/**
 * Server-only loader for /inventario. Reads active clients + every non-discarded
 * idea with its video files, then hands them to the pure core.
 * Returns null on a read error so the page can say so instead of showing zeros.
 */
export async function loadVideoStock(): Promise<VideoStock | null> {
  const supabase = await createClient()

  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name, posting_days')
    .eq('status', 'active')
    .order('name')
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

  return buildVideoStock((clients ?? []) as StockClient[], ideas, todayISOInTimeZone(POST_TZ))
}
