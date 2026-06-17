import type { ContentIdea, ContentIdeaVideo } from '@/lib/supabase/types'
import { isIdeaReadyForCaption } from '@/lib/utils/idea-ready'
import type { ClientCadence, ClientPipelineSummary } from '@/lib/utils/content-batches'
import {
  countMetricoolScheduled,
  findNextNewVideoSlot,
  findNextQueuePublish,
  formatScheduledPublish,
} from '@/lib/utils/client-pipeline-publish'

/**
 * Helpers for the full-screen Client Batch view (clients/[id]/batch).
 *
 * The board works in CLIENT BATCHES: when you open a client you see the whole
 * batch of videos being worked, all travelling the pipeline together. This file
 * maps the real content_ideas + uploaded videos onto the 7-stage pipeline used
 * by the board, in plain Spanish, so the screen reads the same as the Kanban.
 */

/** The 7 pipeline stages, in order — the same workflow as the Kanban board. */
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

export const VIDEO_TYPE_LABEL: Record<string, string> = {
  R: 'Reel',
  P: 'Post',
  C: 'Carrusel',
  S: 'Story',
}

export function contentTypeLabel(type: string | null | undefined): string {
  return VIDEO_TYPE_LABEL[type ?? ''] ?? 'Video'
}

/** Spanish labels for the 7 board stages, matching the approved design. */
export const STAGE_LABEL_ES: Record<BatchStageKey, string> = {
  idea: 'Idea',
  title: 'Título',
  caption: 'Caption',
  video: 'Video',
  edited: 'Edición',
  approval: 'Aprobación',
  publication: 'Publicación',
}

export interface BatchVideoSlots {
  raw: ContentIdeaVideo[]
  broll: ContentIdeaVideo[]
  edited: ContentIdeaVideo[]
}

/** One video card = a content_idea plus its uploaded media grouped by kind. */
export interface BatchVideo extends ContentIdea {
  videos: BatchVideoSlots
}

const STAGE_INDEX = Object.fromEntries(BATCH_STAGES.map((s, i) => [s.key, i])) as Record<
  BatchStageKey,
  number
>

const filled = (s?: string | null) => !!s && s.trim().length > 0
const hasRaw = (v: BatchVideo) => v.videos.raw.length > 0
const hasEdited = (v: BatchVideo) => v.videos.edited.length > 0

/**
 * The pipeline stage a single video has reached. Mirrors content-batches.ideaStage
 * but also treats an uploaded raw/edited file as evidence of recording/editing,
 * since on this screen files are the source of truth the team acts on.
 */
export function videoStageKey(v: BatchVideo): BatchStageKey {
  if (v.published_at || v.status === 'publicada') return 'publication'
  if (v.approval_status === 'approved' || v.approval_status === 'submitted') return 'approval'
  if (v.status === 'producida' || hasEdited(v)) return 'edited'
  if (v.status === 'grabada' || v.recording_date != null || hasRaw(v)) return 'video'
  if (filled(v.generated_caption)) return 'caption'
  if (isIdeaReadyForCaption(v)) return 'caption'
  return 'idea'
}

/** Stage of the whole batch: the LEAST-advanced active video (they move together). */
export function batchStageKey(videos: BatchVideo[]): BatchStageKey {
  const active = videos.filter((v) => v.status !== 'descartada')
  if (active.length === 0) return 'idea'
  if (active.every((v) => v.published_at || v.status === 'publicada')) return 'publication'
  let min: BatchStageKey = 'publication'
  for (const v of active) {
    const s = videoStageKey(v)
    if (STAGE_INDEX[s] < STAGE_INDEX[min]) min = s
  }
  return min
}

export interface StepperStage {
  key: BatchStageKey
  label: string
  done: boolean
  current: boolean
}

/** The 7 stages with done/current flags, for the beginner-friendly stepper. */
export function buildStepper(videos: BatchVideo[]): StepperStage[] {
  const current = STAGE_INDEX[batchStageKey(videos)]
  return BATCH_STAGES.map((s, i) => ({
    key: s.key,
    label: STAGE_LABEL_ES[s.key],
    done: i < current,
    current: i === current,
  }))
}

/** A video is "recorded" once it has reached the Video stage or beyond. */
export function isRecorded(v: BatchVideo): boolean {
  return STAGE_INDEX[videoStageKey(v)] >= STAGE_INDEX.video
}

export interface CardStatus {
  key: 'grabado' | 'por_grabar'
  label: string
}

/** Card status chip: the single thing a beginner needs to know per video. */
export function cardStatus(v: BatchVideo): CardStatus {
  return isRecorded(v)
    ? { key: 'grabado', label: 'Grabado' }
    : { key: 'por_grabar', label: 'Por grabar' }
}

export type SlotTone = 'ready' | 'pending' | 'muted'

export interface SlotStatus {
  label: string
  tone: SlotTone
}

/** File-slot status for the detail panel (raw is required, b-roll optional). */
export function slotStatus(count: number, optional = false): SlotStatus {
  if (count > 0) return { label: 'Listo', tone: 'ready' }
  return optional ? { label: 'Opcional', tone: 'muted' } : { label: 'Pendiente', tone: 'pending' }
}

/** One-line, plain-Spanish "what to do next" for the guidance banner. */
export function batchHint(videos: BatchVideo[]): { stageLabel: string; tip: string } {
  const stage = batchStageKey(videos)
  const tips: Record<BatchStageKey, string> = {
    idea: 'Define el hook y el brief visual de cada video. El caption sale de esa idea.',
    title: 'Completa el título de cada video si aún falta.',
    caption: 'Escribe el caption basado en la idea — así sabrás qué grabar. Luego sube el video.',
    video:
      'Sube el archivo grabado (raw) de cada video. Cuando todos tengan su grabación, el lote avanza a Edición.',
    edited: 'Sube la versión editada de cada video para enviarla a Aprobación.',
    approval: 'Envía los videos al cliente y espera su aprobación para publicar.',
    publication: 'Programa o publica los videos aprobados. ¡Este lote está casi listo!',
  }
  return { stageLabel: STAGE_LABEL_ES[stage], tip: tips[stage] }
}

function batchVideoTitle(v: BatchVideo): string {
  const t = v.title?.trim() || v.hook?.trim()
  return t || 'Sin título'
}

/** Pipeline snapshot for Nuevo video when opened from a client's batch view. */
export function summarizeBatchVideos(
  videos: BatchVideo[],
  cadence: ClientCadence = {},
): ClientPipelineSummary | null {
  const active = videos.filter((v) => v.status !== 'descartada')
  if (active.length === 0) return null
  const stage = batchStageKey(active)
  const published = active.filter((v) => v.published_at || v.status === 'publicada').length
  const items = active
    .map((v) => {
      const s = videoStageKey(v)
      const inMetricool = v.metricool_post_id != null && !(v.published_at || v.status === 'publicada')
      return {
        id: v.id,
        title: batchVideoTitle(v),
        stage: s,
        stageLabel: STAGE_LABEL_ES[s],
        inMetricool,
        publishLabel: v.publish_date
          ? formatScheduledPublish(v.publish_date, cadence.postingTime)
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
    videos: items,
  }
}
