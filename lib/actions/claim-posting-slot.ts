import type { SupabaseClient } from '@supabase/supabase-js'
import { todayISOInTimeZone } from '@/lib/utils/deadlines'
import { POST_TZ } from '@/lib/utils/idea-lab-send-core'
import {
  claimNextPostingSlot,
  occupiedDatesFromSiblings,
} from '@/lib/utils/posting-days-sot'

type Sibling = {
  id: string
  publish_date: string | null
  approval_status: string | null
  published_at: string | null
  metricool_post_id: number | null
  status: string | null
}

/**
 * Stamp this idea with the next free `clients.posting_days` date. Best-effort:
 * approval must still succeed if the client has no cadence or the write fails.
 */
export async function assignCadencePublishDate(
  supabase: SupabaseClient,
  ideaId: string,
): Promise<string | null> {
  try {
    const { data: idea } = await supabase
      .from('content_ideas')
      .select('id, client_id')
      .eq('id', ideaId)
      .single()
    if (!idea?.client_id) return null

    const [{ data: client }, { data: siblings }] = await Promise.all([
      supabase.from('clients').select('posting_days').eq('id', idea.client_id).single(),
      supabase
        .from('content_ideas')
        .select('id, publish_date, approval_status, published_at, metricool_post_id, status')
        .eq('client_id', idea.client_id)
        .neq('status', 'descartada'),
    ])

    const slot = claimNextPostingSlot({
      postingDays: (client?.posting_days as number[] | null) ?? [],
      occupiedDates: occupiedDatesFromSiblings(ideaId, (siblings ?? []) as Sibling[]),
      fromISO: todayISOInTimeZone(POST_TZ),
    })
    if (!slot) return null

    const { error } = await supabase.from('content_ideas').update({ publish_date: slot }).eq('id', ideaId)
    if (error) return null
    return slot
  } catch {
    return null
  }
}
