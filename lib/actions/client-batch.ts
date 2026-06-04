'use server'

import { createClient } from '@/lib/supabase/server'
import { computePostingTargets } from '@/lib/utils/posting-cadence'
import { planSessions, planSlots, type PlannedSlot } from '@/lib/utils/planned-sessions'
import { resolveInterval } from '@/lib/utils/recording-window'
import { getClientVideoBatch, type ClientVideoPipeline } from './video-pipeline'

export interface ClientBatchData {
  pipeline: ClientVideoPipeline
  /** Empty, dated video slots when the client hasn't started (no videos). */
  plannedSlots: PlannedSlot[]
}

/**
 * Everything the Client Batch view needs, fetched in one call so the pipeline
 * board can open it as an in-place overlay (no navigation). Returns null when
 * the client doesn't exist.
 *
 * Auto-provisions the batch's videos (idempotent) so opening a client shows the
 * real, editable video cards for the session instead of empty placeholders.
 */
export async function getClientBatchData(clientId: string): Promise<ClientBatchData | null> {
  await ensureBatchVideos(clientId)
  const pipeline = await getClientVideoBatch(clientId)
  if (!pipeline) return null
  const plannedSlots = pipeline.videos.length === 0 ? await buildPlannedSlots(clientId) : []
  return { pipeline, plannedSlots }
}

/**
 * Idempotently create the session's videos for a client that hasn't started.
 *
 * Only acts when the client is active, has a posting cadence, and has NO active
 * content_ideas yet — then it creates one content_idea per session slot, dated by
 * the cadence (title "Video N", status idea). Returns how many it created. RLS
 * applies, so a viewer without create permission simply gets 0 created.
 */
export async function ensureBatchVideos(clientId: string): Promise<{ created: number }> {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('content_ideas')
    .select('id')
    .eq('client_id', clientId)
    .neq('status', 'descartada')
    .limit(1)
  if (existing && existing.length > 0) return { created: 0 }

  const { data: client } = await supabase
    .from('clients')
    .select('posting_days, status')
    .eq('id', clientId)
    .maybeSingle()
  if (!client || client.status !== 'active') return { created: 0 }

  const postingDays = (client.posting_days ?? []) as number[]
  if (postingDays.length === 0) return { created: 0 }

  const sessions = planSessions({
    monthlyTarget: computePostingTargets(postingDays).perMonth,
    perWeek: postingDays.length,
    intervalWeeks: resolveInterval(null),
    ideasCount: 0,
  })
  const sessionSize = sessions[0]?.total ?? 0
  if (sessionSize === 0) return { created: 0 }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const slots = planSlots(postingDays, sessionSize, new Date())
  const rows = slots.map((s, i) => ({
    client_id: clientId,
    content_type: 'R',
    title: `Video ${i + 1}`,
    status: 'idea',
    publish_date: s.date,
    created_by: user?.id ?? null,
  }))

  const { error } = await supabase.from('content_ideas').insert(rows)
  if (error) {
    console.warn('[client-batch] provision failed:', error.message)
    return { created: 0 }
  }
  return { created: rows.length }
}

/** Empty, dated video slots for the client's current session (cadence-driven). */
export async function buildPlannedSlots(clientId: string): Promise<PlannedSlot[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clients')
    .select('posting_days')
    .eq('id', clientId)
    .maybeSingle()
  if (error || !data) return []

  const postingDays = (data.posting_days ?? []) as number[]
  if (postingDays.length === 0) return []

  const monthlyTarget = computePostingTargets(postingDays).perMonth
  const sessions = planSessions({
    monthlyTarget,
    perWeek: postingDays.length,
    intervalWeeks: resolveInterval(null),
    ideasCount: 0,
  })
  const sessionSize = sessions[0]?.total ?? 0
  if (sessionSize === 0) return []

  return planSlots(postingDays, sessionSize, new Date())
}
