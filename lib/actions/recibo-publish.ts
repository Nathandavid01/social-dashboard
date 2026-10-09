'use server'

import { schedulePoolIdea, unschedulePoolIdea } from '@/lib/actions/client-pool'
import { createClient } from '@/lib/supabase/server'
import { todayISOInTimeZone } from '@/lib/utils/deadlines'
import { POSTING_TZ } from '@/lib/utils/publish-override'
import { reciboScheduleTarget } from '@/lib/recibo/cadence-slot'

/**
 * Schedule this Recibo video in Metricool as a draft on the space date
 * (or the next cadence day when the card has no space date).
 * Reuses schedulePoolIdea — does not publish immediately.
 */
export async function publishReciboOnCadence(
  ideaId: string,
  spaceDateISO?: string | null,
): Promise<{ ok?: true; label?: string; error?: string; reason?: 'pasado' }> {
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
  const todayISO = todayISOInTimeZone(POSTING_TZ)
  const slot = reciboScheduleTarget({
    spaceDateISO,
    postingDays: client?.posting_days,
    postingTime: client?.posting_time,
    postingSchedule: client?.posting_schedule,
    todayISO,
  })
  if (!slot.ok) {
    if (slot.reason === 'pasado') {
      return {
        error: `La fecha ${slot.label ?? spaceDateISO} ya pasó. Elige otra para programar.`,
        reason: 'pasado',
      }
    }
    return {
      error: slot.reason === 'sin-hora'
        ? 'Este cliente tiene días, pero no tiene hora de publicación.'
        : 'Este cliente no tiene días de publicación. Agrégalos en su cadencia.',
    }
  }

  const scheduled = await schedulePoolIdea({ ideaId, date: slot.dateISO, asDraft: true })
  if (scheduled.error) return { error: scheduled.error }
  return { ok: true, label: slot.label }
}

export async function cancelReciboSchedule(ideaId: string) {
  if (!ideaId) return { error: 'Falta el video' }
  return unschedulePoolIdea({ ideaId })
}
