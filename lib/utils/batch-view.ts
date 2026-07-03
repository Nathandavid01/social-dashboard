import type { ContentIdea, ContentIdeaVideo } from '@/lib/supabase/types'
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

/** The 4 pipeline stages, in order — the same short workflow as the Kanban board. */
export const BATCH_STAGES = [
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

/** Spanish labels for the 4 board stages, matching the approved design. */
export const STAGE_LABEL_ES: Record<BatchStageKey, string> = {
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
  /** Person assigned to this video (via its production task). null = unassigned. */
  assignee?: { id: string; full_name: string | null; avatar_url: string | null } | null
}

const STAGE_INDEX = Object.fromEntries(BATCH_STAGES.map((s, i) => [s.key, i])) as Record<
  BatchStageKey,
  number
>

const filled = (s?: string | null) => !!s && s.trim().length > 0
const hasRaw = (v: BatchVideo) => v.videos.raw.length > 0
const hasEdited = (v: BatchVideo) => v.videos.edited.length > 0

/**
 * The pipeline stage a single video has reached. Mirrors content-batches.ideaStage:
 * an uploaded edited file counts as editing done. Everything before the edit —
 * idea, title, caption, recording — collapses into the first "Video" column.
 */
export function videoStageKey(v: BatchVideo): BatchStageKey {
  if (v.published_at || v.status === 'publicada') return 'publication'
  if (v.approval_status === 'approved' || v.approval_status === 'submitted') return 'approval'
  if (v.status === 'producida' || hasEdited(v)) return 'edited'
  return 'video'
}

/** Stage of the whole batch: the LEAST-advanced active video (they move together). */
export function batchStageKey(videos: BatchVideo[]): BatchStageKey {
  const active = videos.filter((v) => v.status !== 'descartada')
  if (active.length === 0) return 'video'
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

/**
 * A video is "recorded" once there is real evidence of a recording. Since the
 * short board collapses pre-edit work into the Video column, we can't use the
 * column index anymore — a card in "Video" may still be unshot. Anything past
 * Video (edited/approval/publication) is recorded by definition.
 */
export function isRecorded(v: BatchVideo): boolean {
  if (videoStageKey(v) !== 'video') return true
  return v.status === 'grabada' || v.recording_date != null || hasRaw(v)
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

export type NextStepTone = 'done' | 'action' | 'waiting' | 'warn'

export interface NextStep {
  label: string
  tone: NextStepTone
}

/**
 * The single "what to do next" line for a video card, in plain Spanish. One
 * clear next action per state so the team never wonders what's missing:
 * caption → edited upload → review → approve → Metricool → published.
 */
export function videoNextStep(v: BatchVideo): NextStep {
  if (v.published_at || v.status === 'publicada') return { label: 'Publicado', tone: 'done' }
  if (v.metricool_post_id != null) return { label: 'Programado en Metricool', tone: 'done' }
  if (v.approval_status === 'approved') {
    // A failed publish must be visible — the row records posting_error; surface it.
    if (filled(v.posting_error)) return { label: 'Error al publicar — revisa y reintenta', tone: 'warn' }
    // Approval doesn't guarantee Metricool readiness — be honest about what's missing.
    if (!filled(v.generated_caption)) return { label: 'Aprobado — falta el caption para Metricool', tone: 'warn' }
    if (!hasEdited(v)) return { label: 'Aprobado — falta el video editado para Metricool', tone: 'warn' }
    return { label: 'Aprobado — listo para Metricool', tone: 'action' }
  }
  if (v.approval_status === 'submitted') return { label: 'En revisión — aprueba o pide cambios', tone: 'waiting' }
  if (v.approval_status === 'revision_needed') return { label: 'Cambios pedidos — corrige y reenvía', tone: 'warn' }
  if (!filled(v.generated_caption)) return { label: 'Siguiente: genera el caption', tone: 'action' }
  if (!hasEdited(v)) return { label: 'Siguiente: sube el video editado', tone: 'action' }
  return { label: 'Siguiente: envía a revisión', tone: 'action' }
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
    video:
      'Define la idea y el caption si faltan, y sube el archivo grabado (raw) de cada video. Cuando todos tengan su grabación, el lote avanza a Edición.',
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
