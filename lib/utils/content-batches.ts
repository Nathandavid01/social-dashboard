import type { IdeaWithPipeline } from '@/lib/supabase/types'
import {
  countMetricoolScheduled,
  findNextNewVideoSlot,
  findNextQueuePublish,
  formatScheduledPublish,
  type ClientCadence,
  type PublishSlotInfo,
} from '@/lib/utils/client-pipeline-publish'

/**
 * The board works in CLIENT BATCHES, not single videos: when you work a client
 * you work their whole period (month / week / recording session), so all of a
 * client's videos travel the pipeline together as one card.
 *
 * Columns in the user's order — Idea first, Title second.
 */
export const BATCH_STAGES = [
  { key: 'idea', label: 'Idea' },
  { key: 'title', label: 'Title' },
  { key: 'caption', label: 'Caption' },
  { key: 'video', label: 'Video' },
  { key: 'edited', label: 'Edited' },
  { key: 'approval', label: 'Approval' },
  { key: 'publication', label: 'Publication' },
] as const

export type BatchStageKey = (typeof BATCH_STAGES)[number]['key']
const STAGE_INDEX = Object.fromEntries(BATCH_STAGES.map((s, i) => [s.key, i])) as Record<BatchStageKey, number>

/** Spanish labels for pipeline stages (shared with batch view + Nuevo video dialog). */
export const STAGE_LABEL_ES: Record<BatchStageKey, string> = {
  idea: 'Idea',
  title: 'Título',
  caption: 'Caption',
  video: 'Video',
  edited: 'Edición',
  approval: 'Aprobación',
  publication: 'Publicación',
}

export type { ClientCadence, PublishSlotInfo } from '@/lib/utils/client-pipeline-publish'

export interface ClientPipelineVideoSummary {
  id: string
  title: string
  stage: BatchStageKey
  stageLabel: string
  inMetricool: boolean
  publishLabel: string | null
}

export interface ClientPipelineSummary {
  total: number
  published: number
  batchStage: BatchStageKey
  batchStageLabel: string
  metricoolScheduled: number
  hasMetricool: boolean
  nextPublish: PublishSlotInfo | null
  nextNewVideo: PublishSlotInfo | null
  videos: ClientPipelineVideoSummary[]
}

function ideaTitle(idea: IdeaWithPipeline): string {
  const t = idea.title?.trim() || idea.hook?.trim()
  return t || 'Sin título'
}

function summarizeActiveIdeas(active: IdeaWithPipeline[], cadence: ClientCadence = {}): ClientPipelineSummary {
  const stage = batchStage(active)
  const published = active.filter((i) => i.published_at || i.status === 'publicada').length
  const videos = active
    .map((i) => {
      const s = ideaStage(i)
      const inMetricool = i.metricool_post_id != null && !(i.published_at || i.status === 'publicada')
      return {
        id: i.id,
        title: ideaTitle(i),
        stage: s,
        stageLabel: STAGE_LABEL_ES[s],
        inMetricool,
        publishLabel: i.publish_date
          ? formatScheduledPublish(i.publish_date, cadence.postingTime)
          : null,
      }
    })
    .sort((a, b) => STAGE_INDEX[a.stage] - STAGE_INDEX[b.stage] || a.title.localeCompare(b.title))
  return {
    total: active.length,
    published,
    batchStage: stage,
    batchStageLabel: STAGE_LABEL_ES[stage],
    metricoolScheduled: countMetricoolScheduled(active),
    hasMetricool: !!(cadence.metricoolBlogId && cadence.metricoolBlogId.trim()),
    nextPublish: findNextQueuePublish(active, cadence),
    nextNewVideo: findNextNewVideoSlot(active.length, cadence),
    videos,
  }
}

/** Per-client pipeline snapshot for the Nuevo video picker. */
export function buildClientPipelineIndex(
  ideas: IdeaWithPipeline[],
  clientCadence: Record<string, ClientCadence> = {},
): Record<string, ClientPipelineSummary> {
  const byClient = new Map<string, IdeaWithPipeline[]>()
  for (const i of ideas) {
    const cid = i.client?.id ?? i.client_id
    if (!cid) continue
    const arr = byClient.get(cid) ?? []
    arr.push(i)
    byClient.set(cid, arr)
  }
  const out: Record<string, ClientPipelineSummary> = {}
  for (const [clientId, list] of Array.from(byClient.entries())) {
    const active = list.filter((i) => i.status !== 'descartada')
    if (active.length === 0) continue
    out[clientId] = summarizeActiveIdeas(active, clientCadence[clientId] ?? {})
  }
  return out
}

/** Pipeline snapshot for a client with no videos yet — still shows next cadence slot. */
export function emptyClientPipelineSummary(cadence: ClientCadence = {}): ClientPipelineSummary | null {
  const nextNewVideo = findNextNewVideoSlot(0, cadence)
  if (!nextNewVideo && !cadence.metricoolBlogId) return null
  return {
    total: 0,
    published: 0,
    batchStage: 'idea',
    batchStageLabel: STAGE_LABEL_ES.idea,
    metricoolScheduled: 0,
    hasMetricool: !!(cadence.metricoolBlogId && cadence.metricoolBlogId.trim()),
    nextPublish: null,
    nextNewVideo,
    videos: [],
  }
}

const filled = (s?: string | null) => !!s && s.trim().length > 0

/** The pipeline stage a single idea has reached (idea = raw concept → publication). */
export function ideaStage(idea: IdeaWithPipeline): BatchStageKey {
  if (idea.published_at || idea.status === 'publicada') return 'publication'
  if (idea.approval_status === 'approved' || idea.approval_status === 'submitted') return 'approval'
  if (idea.status === 'producida') return 'edited'
  if (idea.status === 'grabada') return 'video'
  if (filled(idea.generated_caption)) return 'caption'
  if (filled(idea.hook) || filled(idea.visual_brief)) return 'title'
  return 'idea'
}

export interface ClientBatch {
  clientId: string
  clientName: string
  /** The person the batch is assigned to (drives its color). null = unassigned. */
  assignee: { id: string; name: string } | null
  ideas: IdeaWithPipeline[]
  /** Column the batch sits in — the LEAST-advanced active video (they move together). */
  stage: BatchStageKey
  /** Total videos in the batch. */
  total: number
  /** Videos already pulled ahead of the batch's column (informational). */
  ahead: number
  platforms: string[]
}

/** 0..1 progress of a batch along the whole pipeline (column position). */
export function batchProgress(stage: BatchStageKey): number {
  return STAGE_INDEX[stage] / (BATCH_STAGES.length - 1)
}

/** Stage of a whole batch: the least-advanced active video, or publication when all are out. */
export function batchStage(ideas: IdeaWithPipeline[]): BatchStageKey {
  const active = ideas.filter((i) => i.status !== 'descartada')
  if (active.length === 0) return 'idea'
  const allPublished = active.every((i) => i.published_at || i.status === 'publicada')
  if (allPublished) return 'publication'
  let min: BatchStageKey = 'publication'
  for (const i of active) {
    const s = ideaStage(i)
    if (STAGE_INDEX[s] < STAGE_INDEX[min]) min = s
  }
  return min
}

/** Pick the assignee that owns the most videos in the batch (ties → first seen). */
function dominantAssignee(ideas: IdeaWithPipeline[]): { id: string; name: string } | null {
  const counts = new Map<string, { id: string; name: string; n: number }>()
  for (const i of ideas) {
    const a = i.assignee
    if (!a) continue
    const e = counts.get(a.id) ?? { id: a.id, name: a.full_name ?? '—', n: 0 }
    e.n++
    counts.set(a.id, e)
  }
  let best: { id: string; name: string; n: number } | null = null
  for (const e of Array.from(counts.values())) if (!best || e.n > best.n) best = e
  return best ? { id: best.id, name: best.name } : null
}

/** Group ideas into one batch per client (excludes fully-discarded clients). */
export function groupIntoBatches(ideas: IdeaWithPipeline[]): ClientBatch[] {
  const byClient = new Map<string, IdeaWithPipeline[]>()
  for (const i of ideas) {
    const cid = i.client?.id ?? i.client_id
    if (!cid) continue
    const arr = byClient.get(cid) ?? []
    arr.push(i)
    byClient.set(cid, arr)
  }

  const batches: ClientBatch[] = []
  for (const [clientId, list] of Array.from(byClient.entries())) {
    const active = list.filter((i) => i.status !== 'descartada')
    if (active.length === 0) continue
    const stage = batchStage(active)
    const ahead = active.filter((i) => STAGE_INDEX[ideaStage(i)] > STAGE_INDEX[stage]).length
    const platforms = active[0]?.client?.platforms ?? []
    batches.push({
      clientId,
      clientName: active[0]?.client?.name ?? 'Sin cliente',
      assignee: dominantAssignee(active),
      ideas: active,
      stage,
      total: active.length,
      ahead,
      platforms,
    })
  }
  return batches.sort((a, b) => a.clientName.localeCompare(b.clientName))
}

/** Batches bucketed by their column. */
export function bucketBatches(batches: ClientBatch[]): Record<BatchStageKey, ClientBatch[]> {
  const out = { idea: [], title: [], caption: [], video: [], edited: [], approval: [], publication: [] } as Record<BatchStageKey, ClientBatch[]>
  for (const b of batches) out[b.stage].push(b)
  return out
}

/** Adjacent stage for moving a whole batch forward/back. */
export function adjacentBatchStage(stage: BatchStageKey, dir: 1 | -1): BatchStageKey | null {
  const i = STAGE_INDEX[stage] + dir
  return i >= 0 && i < BATCH_STAGES.length ? BATCH_STAGES[i].key : null
}
