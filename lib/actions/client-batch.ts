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
 */
export async function getClientBatchData(clientId: string): Promise<ClientBatchData | null> {
  const pipeline = await getClientVideoBatch(clientId)
  if (!pipeline) return null
  const plannedSlots = pipeline.videos.length === 0 ? await buildPlannedSlots(clientId) : []
  return { pipeline, plannedSlots }
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
