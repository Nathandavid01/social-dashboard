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
export const ENTREGA_BATCH_STAGES = [
  { key: 'edited', label: 'Edited' },
  { key: 'approval', label: 'Approval' },
  { key: 'copy', label: 'Copy' },
  { key: 'publication', label: 'Publication' },
] as const

export type EntregaStageKey = (typeof ENTREGA_BATCH_STAGES)[number]['key']
const STAGE_INDEX = Object.fromEntries(ENTREGA_BATCH_STAGES.map((s, i) => [s.key, i])) as Record<EntregaStageKey, number>

/** Spanish labels for pipeline stages (shared with batch view + Nuevo video dialog). */
export const ENTREGA_LABEL_ES: Record<EntregaStageKey, string> = {
  edited: 'Editado',
  approval: 'Revisión',
  copy: 'Copy',
  publication: 'Publicación',
}

export type { ClientCadence, PublishSlotInfo } from '@/lib/utils/client-pipeline-publish'

export interface ClientPipelineVideoSummary {
  id: string
  title: string
  stage: EntregaStageKey
  stageLabel: string
  inMetricool: boolean
  publishLabel: string | null
}

export interface ClientPipelineSummary {
  total: number
  published: number
  batchStage: EntregaStageKey
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
        stageLabel: ENTREGA_LABEL_ES[s],
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
    batchStageLabel: ENTREGA_LABEL_ES[stage],
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
    batchStageLabel: ENTREGA_LABEL_ES.edited,
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
export function ideaStage(idea: IdeaWithPipeline): EntregaStageKey {
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

export interface EntregaBatch {
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
  stage: EntregaStageKey
  /** How many of the batch's videos sit at each pipeline stage (status breakdown). */
  stageCounts: Record<EntregaStageKey, number>
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
 * One card per (client, stage) instead of one card per client.
 *
 * A batch normally sits in the column of its LEAST-advanced video, which means
 * sending one video of three to review leaves the card parked in Editado and
 * the submission looks like it did nothing. Splitting puts the client in every
 * column where they actually have videos, each card counting only its own.
 *
 * Cards keep the same clientId, so callers must key by clientId + stage.
 */
export function splitBatchesByStage(batches: EntregaBatch[]): EntregaBatch[] {
  const out: EntregaBatch[] = []
  for (const b of batches) {
    const byStage = new Map<EntregaStageKey, IdeaWithPipeline[]>()
    for (const i of b.ideas) {
      if (i.status === 'descartada') continue
      const s = ideaStage(i)
      const arr = byStage.get(s) ?? []
      arr.push(i)
      byStage.set(s, arr)
    }
    for (const s of ENTREGA_BATCH_STAGES) {
      const ideas = byStage.get(s.key)
      if (!ideas || ideas.length === 0) continue
      const counts = emptyStageCounts()
      counts[s.key] = ideas.length
      out.push({
        ...b,
        ideas,
        stage: s.key,
        stageCounts: counts,
        total: ideas.length,
        ahead: 0,
        revisionNeeded: ideas.filter((i) => i.approval_status === 'revision_needed').length,
        assigneeIds: Array.from(new Set(ideas.map((i) => i.assignee?.id).filter(Boolean) as string[])),
      })
    }
  }
  return out
}

/** 0..1 progress of a batch along the whole pipeline (column position). */
export function batchProgress(stage: EntregaStageKey): number {
  return STAGE_INDEX[stage] / (ENTREGA_BATCH_STAGES.length - 1)
}

/** Stage of a whole batch: the least-advanced active video, or publication when all are out. */
export function batchStage(ideas: IdeaWithPipeline[]): EntregaStageKey {
  const active = ideas.filter((i) => i.status !== 'descartada')
  if (active.length === 0) return 'edited'
  const allPublished = active.every((i) => i.published_at || i.status === 'publicada')
  if (allPublished) return 'publication'
  let min: EntregaStageKey = 'publication'
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
/**
 * Una tarjeta por VIDEO.
 *
 * Agrupaba por cliente, y eso juntaba en una misma tarjeta videos de días
 * distintos. Con la fecha elegida video a video ya no tiene sentido: cada uno
 * tiene que caer en el día de SU fecha, aunque el editor suba cinco de golpe.
 *
 * Se conserva la estructura de "batch" —de un solo video— para no reescribir el
 * tablero entero: lo que cambia es por qué se agrupa.
 */
/** React / override key: one card per video, never client+stage (that reused last week). */
export function entregaCardKey(b: Pick<EntregaBatch, 'clientId' | 'stage' | 'ideas'>): string {
  return `${b.clientId}:${b.stage}:${b.ideas[0]?.id ?? 'none'}`
}

export function groupIntoBatches(ideas: IdeaWithPipeline[]): EntregaBatch[] {
  const byClient = new Map<string, IdeaWithPipeline[]>()
  for (const i of ideas) {
    const cid = i.client?.id ?? i.client_id
    if (!cid) continue
    // Por id del video, no del cliente. El cliente va delante en la clave para
    // que el orden siga juntando visualmente lo del mismo.
    byClient.set(`${cid}:${i.id}`, [i])
  }

  const batches: EntregaBatch[] = []
  for (const [clave, list] of Array.from(byClient.entries())) {
    const clientId = clave.split(':')[0]
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
export function bucketIdeasByStage(ideas: IdeaWithPipeline[]): Record<EntregaStageKey, IdeaWithPipeline[]> {
  const out = emptyStageBuckets<IdeaWithPipeline>()
  for (const i of ideas) {
    if (i.status === 'descartada') continue
    out[ideaStage(i)].push(i)
  }
  return out
}

/**
 * One empty array per stage, derived from ENTREGA_BATCH_STAGES. Do NOT hand-write this
 * object literal — a `as Record<EntregaStageKey, T[]>` cast on a literal that is
 * missing a stage type-checks fine and then blows up at render with
 * "Cannot read properties of undefined". Adding a column must be a one-line
 * change to ENTREGA_BATCH_STAGES.
 */
export function emptyStageBuckets<T>(): Record<EntregaStageKey, T[]> {
  return Object.fromEntries(ENTREGA_BATCH_STAGES.map((s) => [s.key, [] as T[]])) as Record<EntregaStageKey, T[]>
}

/** Zeroed counter per stage. Same reasoning as emptyStageBuckets — a hand-written
 *  literal that misses a stage yields `undefined++` → NaN, silently. */
export function emptyStageCounts(): Record<EntregaStageKey, number> {
  return Object.fromEntries(ENTREGA_BATCH_STAGES.map((s) => [s.key, 0])) as Record<EntregaStageKey, number>
}

/** Batches bucketed by their column. */
export function bucketBatches(batches: EntregaBatch[]): Record<EntregaStageKey, EntregaBatch[]> {
  const out = emptyStageBuckets<EntregaBatch>()
  for (const b of batches) out[b.stage].push(b)
  return out
}

/** Adjacent stage for moving a whole batch forward/back. */
export function adjacentBatchStage(stage: EntregaStageKey, dir: 1 | -1): EntregaStageKey | null {
  const i = STAGE_INDEX[stage] + dir
  return i >= 0 && i < ENTREGA_BATCH_STAGES.length ? ENTREGA_BATCH_STAGES[i].key : null
}
