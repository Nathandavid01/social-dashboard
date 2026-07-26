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
 * 4-column pipeline (per product decision): the process starts when the EDITOR
 * delivers. They pick the client and paste the Drive link, and the card enters
 * at "Editado". Idea/recording work happens before the board and has no column.
 */
export const BATCH_STAGES = [
  { key: 'edited', label: 'Edited' },
  { key: 'approval', label: 'Approval' },
  { key: 'copy', label: 'Copy' },
  { key: 'publication', label: 'Publication' },
] as const

export type BatchStageKey = (typeof BATCH_STAGES)[number]['key']
const STAGE_INDEX = Object.fromEntries(BATCH_STAGES.map((s, i) => [s.key, i])) as Record<BatchStageKey, number>

/** Spanish labels for pipeline stages (shared with batch view + Nuevo video dialog). */
export const STAGE_LABEL_ES: Record<BatchStageKey, string> = {
  edited: 'Editado',
  approval: 'Revisión',
  copy: 'Copy',
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
    batchStage: 'edited',
    batchStageLabel: STAGE_LABEL_ES.edited,
    metricoolScheduled: 0,
    hasMetricool: !!(cadence.metricoolBlogId && cadence.metricoolBlogId.trim()),
    nextPublish: null,
    nextNewVideo,
    videos: [],
  }
}

/**
 * The pipeline stage a single idea has reached. Anything not yet sent to review
 * sits in the first "Editado" column — the board's entry point.
 */
export function ideaStage(idea: IdeaWithPipeline): BatchStageKey {
  if (idea.published_at || idea.status === 'publicada') return 'publication'
  // Approved internally → Copy, until the caption exists. See computeStage in
  // pipeline-stages.ts — the two derivations must stay in step.
  if (idea.approval_status === 'approved') {
    return idea.generated_caption && idea.generated_caption.trim() ? 'publication' : 'copy'
  }
  // Only `submitted` sits with the reviewer; `revision_needed` goes back to the
  // editor's column. See computeStage in pipeline-stages.ts.
  if (idea.approval_status === 'submitted') return 'approval'
  return 'edited'
}

export interface ClientBatch {
  clientId: string
  clientName: string
  /** Client account status (active / paused / onboarding). null when unknown. */
  clientStatus: string | null
  /** The person the batch is assigned to (drives its color). null = unassigned. */
  assignee: { id: string; name: string } | null
  /** Every distinct person with a video in this batch (for the "Mis videos" filter). */
  assigneeIds: string[]
  ideas: IdeaWithPipeline[]
  /** Column the batch sits in — the LEAST-advanced active video (they move together). */
  stage: BatchStageKey
  /** How many of the batch's videos sit at each pipeline stage (status breakdown). */
  stageCounts: Record<BatchStageKey, number>
  /** Total videos in the batch. */
  total: number
  /** Videos already pulled ahead of the batch's column (informational). */
  ahead: number
  /** Videos the reviewer sent back for changes — they sit in Editado, and the
   *  card flags them so the editor sees work returned without opening it. */
  revisionNeeded: number
  platforms: string[]
}

/**
 * Short breakdown for a split batch, e.g. ["1 con cambios", "2 en Copy"].
 *
 * The card sits in the column of its LEAST-advanced video, so without this a
 * client whose videos are half-approved reads as if nothing moved. The batch's
 * own column is left out — it's the one you're already looking at. Returns []
 * when the whole batch is in one place and there is nothing to explain.
 */
export function batchBreakdown(batch: ClientBatch): string[] {
  const out: string[] = []
  if (batch.revisionNeeded > 0) out.push(`${batch.revisionNeeded} con cambios`)
  for (const s of BATCH_STAGES) {
    if (s.key === batch.stage) continue
    const n = batch.stageCounts[s.key]
    if (n > 0) out.push(`${n} en ${STAGE_LABEL_ES[s.key]}`)
  }
  return out
}

/** 0..1 progress of a batch along the whole pipeline (column position). */
export function batchProgress(stage: BatchStageKey): number {
  return STAGE_INDEX[stage] / (BATCH_STAGES.length - 1)
}

/** Stage of a whole batch: the least-advanced active video, or publication when all are out. */
export function batchStage(ideas: IdeaWithPipeline[]): BatchStageKey {
  const active = ideas.filter((i) => i.status !== 'descartada')
  if (active.length === 0) return 'edited'
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
    const revisionNeeded = active.filter((i) => i.approval_status === 'revision_needed').length
    const platforms = active[0]?.client?.platforms ?? []

    // Per-stage video count (the "status of the videos within" the batch).
    const stageCounts = emptyStageCounts()
    const assigneeSet = new Set<string>()
    for (const i of active) {
      stageCounts[ideaStage(i)]++
      if (i.assignee?.id) assigneeSet.add(i.assignee.id)
    }

    batches.push({
      clientId,
      clientName: active[0]?.client?.name ?? 'Sin cliente',
      clientStatus: active[0]?.client?.status ?? null,
      assignee: dominantAssignee(active),
      assigneeIds: Array.from(assigneeSet),
      ideas: active,
      stage,
      stageCounts,
      total: active.length,
      ahead,
      revisionNeeded,
      platforms,
    })
  }
  return batches.sort((a, b) => a.clientName.localeCompare(b.clientName))
}

/**
 * Per-VIDEO board: each active idea bucketed into its OWN pipeline-stage column
 * (one card per video, not per client). Discarded videos are excluded.
 */
export function bucketIdeasByStage(ideas: IdeaWithPipeline[]): Record<BatchStageKey, IdeaWithPipeline[]> {
  const out = emptyStageBuckets<IdeaWithPipeline>()
  for (const i of ideas) {
    if (i.status === 'descartada') continue
    out[ideaStage(i)].push(i)
  }
  return out
}

/**
 * One empty array per stage, derived from BATCH_STAGES. Do NOT hand-write this
 * object literal — a `as Record<BatchStageKey, T[]>` cast on a literal that is
 * missing a stage type-checks fine and then blows up at render with
 * "Cannot read properties of undefined". Adding a column must be a one-line
 * change to BATCH_STAGES.
 */
export function emptyStageBuckets<T>(): Record<BatchStageKey, T[]> {
  return Object.fromEntries(BATCH_STAGES.map((s) => [s.key, [] as T[]])) as Record<BatchStageKey, T[]>
}

/** Zeroed counter per stage. Same reasoning as emptyStageBuckets — a hand-written
 *  literal that misses a stage yields `undefined++` → NaN, silently. */
export function emptyStageCounts(): Record<BatchStageKey, number> {
  return Object.fromEntries(BATCH_STAGES.map((s) => [s.key, 0])) as Record<BatchStageKey, number>
}

/** Batches bucketed by their column. */
export function bucketBatches(batches: ClientBatch[]): Record<BatchStageKey, ClientBatch[]> {
  const out = emptyStageBuckets<ClientBatch>()
  for (const b of batches) out[b.stage].push(b)
  return out
}

/** Adjacent stage for moving a whole batch forward/back. */
export function adjacentBatchStage(stage: BatchStageKey, dir: 1 | -1): BatchStageKey | null {
  const i = STAGE_INDEX[stage] + dir
  return i >= 0 && i < BATCH_STAGES.length ? BATCH_STAGES[i].key : null
}
