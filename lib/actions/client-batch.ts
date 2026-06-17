'use server'

import { createClient } from '@/lib/supabase/server'
import { computePostingTargets } from '@/lib/utils/posting-cadence'
import { planSessions, planSlots, type PlannedSlot } from '@/lib/utils/planned-sessions'
import { resolveInterval } from '@/lib/utils/recording-window'
import { getClientVideoBatch, type ClientVideoPipeline } from './video-pipeline'

export interface BatchConfig {
  /** Optional name/period for the current batch (LOTE). */
  batchLabel: string | null
  /** Optional override of videos per batch; null = derived from cadence. */
  videosPerBatch: number | null
}

export interface TeamMember {
  id: string
  full_name: string | null
}

export interface ClientBatchData {
  pipeline: ClientVideoPipeline
  /** Empty, dated video slots when the client hasn't started (no videos). */
  plannedSlots: PlannedSlot[]
  /** Editable LOTE + cantidad config (degrades to nulls before migration 0031). */
  config: BatchConfig
  /** Team members for the ENCARGADO picker. */
  members: TeamMember[]
}

/**
 * Defensive read of the per-client batch config (migration 0031). Returns nulls
 * if the columns don't exist yet, so the view works before the migration lands.
 */
export async function getClientBatchConfig(clientId: string): Promise<BatchConfig> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clients')
    .select('batch_label, videos_per_batch')
    .eq('id', clientId)
    .maybeSingle()
  if (error || !data) return { batchLabel: null, videosPerBatch: null }
  const row = data as { batch_label?: string | null; videos_per_batch?: number | null }
  return { batchLabel: row.batch_label ?? null, videosPerBatch: row.videos_per_batch ?? null }
}

/** Team members (for the ENCARGADO picker). */
export async function getTeamMembers(): Promise<TeamMember[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('id, full_name').order('full_name')
  return (data ?? []) as TeamMember[]
}

/** Assign (or unassign) the client's owner/encargado. Uses clients.assigned_to. */
export async function assignClient(clientId: string, userId: string | null): Promise<{ ok?: true; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('clients').update({ assigned_to: userId }).eq('id', clientId)
  if (error) return { error: error.message }
  return { ok: true }
}

/** Save the editable LOTE label + videos-per-batch override (needs migration 0031). */
export async function updateClientBatchConfig(
  clientId: string,
  input: { batchLabel?: string | null; videosPerBatch?: number | null },
): Promise<{ ok?: true; error?: string }> {
  const supabase = await createClient()
  const patch: Record<string, unknown> = {}
  if ('batchLabel' in input) patch.batch_label = input.batchLabel?.trim() || null
  if ('videosPerBatch' in input) patch.videos_per_batch = input.videosPerBatch ?? null
  if (Object.keys(patch).length === 0) return { ok: true }
  const { error } = await supabase.from('clients').update(patch).eq('id', clientId)
  if (error) return { error: error.message }
  return { ok: true }
}

/**
 * Everything the Client Batch view needs, fetched in one call so the pipeline
 * board can open it as an in-place overlay (no navigation). Returns null when
 * the client doesn't exist.
 *
 * Auto-provisions the next single video (idempotent) when the client has none yet,
 * so opening a client shows one real editable card instead of bulk-creating the
 * whole session. Respects an explicit videos_per_batch override when set.
 */
export async function getClientBatchData(clientId: string): Promise<ClientBatchData | null> {
  await ensureBatchVideos(clientId)
  const pipeline = await getClientVideoBatch(clientId)
  if (!pipeline) return null
  const [plannedSlots, config, members] = await Promise.all([
    pipeline.videos.length === 0 ? buildPlannedSlots(clientId) : Promise.resolve([]),
    getClientBatchConfig(clientId),
    getTeamMembers(),
  ])
  return { pipeline, plannedSlots, config, members }
}

/**
 * Idempotently create the session's videos for a client that hasn't started.
 *
 * Only acts when the client is active, has a posting cadence, and has NO active
 * content_ideas yet — then it creates one content_idea for the next slot, dated by
 * the cadence (title "Video 1", status idea). Returns how many it created. RLS
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

  const { videosPerBatch } = await getClientBatchConfig(clientId)
  // One video at a time unless the client has an explicit batch-size override.
  const sessionSize = videosPerBatch ?? 1
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
  const { videosPerBatch } = await getClientBatchConfig(clientId)
  const sessionSize = videosPerBatch ?? (sessions[0]?.total ?? 0)
  if (sessionSize === 0) return []

  return planSlots(postingDays, sessionSize, new Date())
}
