import { createClient } from '@/lib/supabase/server'
import { todayISOInTimeZone } from '@/lib/utils/deadlines'
import { POST_TZ } from '@/lib/utils/idea-lab-send-core'
import { buildVideoStock, type StockClient, type StockIdea, type VideoStock } from './video-stock-core'

/** PostgREST caps a response at 1000 rows; page through so big agencies are not cut off. */
const PAGE = 1000

const IDEA_COLUMNS =
  'id, client_id, status, published_at, manual_posted_status, metricool_post_id, posted_at, ' +
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

  const ideas: StockIdea[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('content_ideas')
      .select(IDEA_COLUMNS)
      .neq('status', 'descartada')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) return null
    const rows = (data ?? []) as unknown as StockIdea[]
    ideas.push(...rows)
    if (rows.length < PAGE) break
  }

  return buildVideoStock((clients ?? []) as StockClient[], ideas, todayISOInTimeZone(POST_TZ))
}
