'use server'

import { schedulePoolIdea } from '@/lib/actions/client-pool'
import { createClient } from '@/lib/supabase/server'
import { todayISOInTimeZone } from '@/lib/utils/deadlines'
import { POSTING_TZ } from '@/lib/utils/publish-override'
import { nextCadenceSlot } from '@/lib/recibo/cadence-slot'

/**
 * Schedule this Recibo video in Metricool on the client's next cadence day and hour.
 * Does not pick a date of its own when the client has no cadence.
 */
export async function publishReciboOnCadence(ideaId: string): Promise<{ ok?: true; label?: string; error?: string }> {
  if (!ideaId) return { error: 'Falta el video' }
  const supabase = await createClient()
  const { data: idea, error } = await supabase
    .from('content_ideas')
    .select('id, client:clients!content_ideas_client_id_fkey(posting_days, posting_time, posting_schedule)')
    .eq('id', ideaId)
    .maybeSingle()
  if (error || !idea) return { error: error?.message || 'Video no encontrado' }

  const client = (Array.isArray(idea.client) ? idea.client[0] : idea.client) as {
    posting_days?: number[] | null
    posting_time?: string | null
    posting_schedule?: Record<string, string> | null
  } | null
  const slot = nextCadenceSlot({
    postingDays: client?.posting_days,
    postingTime: client?.posting_time,
    postingSchedule: client?.posting_schedule,
    todayISO: todayISOInTimeZone(POSTING_TZ),
  })
  if (!slot.ok) {
    return {
      error: slot.reason === 'sin-hora'
        ? 'Este cliente tiene días, pero no tiene hora de publicación.'
        : 'Este cliente no tiene días de publicación. Agrégalos en su cadencia.',
    }
  }

  const scheduled = await schedulePoolIdea({ ideaId, date: slot.dateISO })
  if (scheduled.error) return { error: scheduled.error }
  return { ok: true, label: slot.label }
}
