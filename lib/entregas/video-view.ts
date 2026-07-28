import type { ContentIdea, ContentIdeaVideo } from '@/lib/supabase/types'
import type { ClientCadence, ClientPipelineSummary } from '@/lib/entregas/batches'
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
export const ENTREGA_BATCH_STAGES = [
  { key: 'edited', label: 'Edited' },
  { key: 'approval', label: 'Approval' },
  { key: 'copy', label: 'Copy' },
  { key: 'publication', label: 'Publication' },
] as const

export type EntregaStageKey = (typeof ENTREGA_BATCH_STAGES)[number]['key']

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
export const ENTREGA_LABEL_ES: Record<EntregaStageKey, string> = {
  edited: 'Editado',
  approval: 'Revisión',
  copy: 'Copy',
  publication: 'Publicación',
}

export interface EntregaVideoSlots {
  raw: ContentIdeaVideo[]
  broll: ContentIdeaVideo[]
  edited: ContentIdeaVideo[]
}

/** One video card = a content_idea plus its uploaded media grouped by kind. */
export interface EntregaVideo extends ContentIdea {
  videos: EntregaVideoSlots
  /** Person assigned to this video (via its production task). null = unassigned. */
  assignee?: { id: string; full_name: string | null; avatar_url: string | null } | null
}

const STAGE_INDEX = Object.fromEntries(ENTREGA_BATCH_STAGES.map((s, i) => [s.key, i])) as Record<
  EntregaStageKey,
  number
>

const filled = (s?: string | null) => !!s && s.trim().length > 0
const hasRaw = (v: EntregaVideo) => v.videos.raw.length > 0
const hasEdited = (v: EntregaVideo) => v.videos.edited.length > 0

/**
 * The pipeline stage a single video has reached. Mirrors content-batches.ideaStage:
 * an uploaded edited file counts as editing done. Everything before the edit —
 * idea, title, caption, recording — collapses into the first "Video" column.
 */
export function videoStageKey(v: EntregaVideo): EntregaStageKey {
  if (v.published_at || v.status === 'publicada') return 'publication'
  if (v.approval_status === 'approved') return filled(v.generated_caption) ? 'publication' : 'copy'
  if (v.approval_status === 'submitted') return 'approval'
  return 'edited'
}

/** Stage of the whole batch: the LEAST-advanced active video (they move together). */
export function batchStageKey(videos: EntregaVideo[]): EntregaStageKey {
  const active = videos.filter((v) => v.status !== 'descartada')
  if (active.length === 0) return 'edited'
  if (active.every((v) => v.published_at || v.status === 'publicada')) return 'publication'
  let min: EntregaStageKey = 'publication'
  for (const v of active) {
    const s = videoStageKey(v)
    if (STAGE_INDEX[s] < STAGE_INDEX[min]) min = s
  }
  return min
}

export interface StepperStage {
  key: EntregaStageKey
  label: string
  done: boolean
  current: boolean
}

/** The 7 stages with done/current flags, for the beginner-friendly stepper. */
export function buildStepper(videos: EntregaVideo[]): StepperStage[] {
  const current = STAGE_INDEX[batchStageKey(videos)]
  return ENTREGA_BATCH_STAGES.map((s, i) => ({
    key: s.key,
    label: ENTREGA_LABEL_ES[s.key],
    done: i < current,
    current: i === current,
  }))
}

/**
 * A video is "recorded" once there is real evidence of a recording. The board no
 * longer has a Video column to infer this from — a card in "Editado" may still
 * be unshot — so this reads the evidence directly. Anything already past review
 * is recorded by definition; otherwise we need a status, a date, or a file.
 *
 * Do NOT reduce this to a column check: every card is now at least 'edited', so
 * a stage-based test would mark everything recorded and silently drop the
 * "grabar" task from My Day.
 */
export function isRecorded(v: EntregaVideo): boolean {
  if (videoStageKey(v) !== 'edited') return true
  return (
    v.status === 'grabada' ||
    v.status === 'producida' ||
    v.recording_date != null ||
    hasRaw(v) ||
    hasEdited(v)
  )
}

export interface CardStatus {
  key: 'grabado' | 'por_grabar'
  label: string
}

/** Card status chip: the single thing a beginner needs to know per video. */
export function cardStatus(v: EntregaVideo): CardStatus {
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
export function videoNextStep(v: EntregaVideo): NextStep {
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
  // Nothing has been shot yet — the caption is not the next step, the CAMERA is.
  // Without this the board tells the team to "genera el caption" for a planned
  // slot that doesn't exist yet (most of the board, in practice). Checked AFTER
  // the approval states: a video in review/revision was obviously recorded.
  if (!isRecorded(v)) return { label: 'Siguiente: graba el video', tone: 'action' }
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
export function batchHint(videos: EntregaVideo[]): { stageLabel: string; tip: string } {
  const stage = batchStageKey(videos)
  const tips: Record<EntregaStageKey, string> = {
    edited:
      'Elige el cliente y pega el link de Drive del video editado para enviarlo a revisión del equipo.',
    approval:
      'Un compañero con permiso de aprobación revisa cada video: lo aprueba o lo devuelve al editor con los cambios.',
    copy: 'Videos aprobados. Escribe el copy de cada uno para dejarlos listos para Metricool.',
    publication: 'Programa o publica los videos aprobados. ¡Este lote está casi listo!',
  }
  return { stageLabel: ENTREGA_LABEL_ES[stage], tip: tips[stage] }
}

function batchVideoTitle(v: EntregaVideo): string {
  const t = v.title?.trim() || v.hook?.trim()
  return t || 'Sin título'
}

/** Pipeline snapshot for Nuevo video when opened from a client's batch view. */
export function summarizeEntregaVideos(
  videos: EntregaVideo[],
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
        stageLabel: ENTREGA_LABEL_ES[s],
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
    batchStageLabel: ENTREGA_LABEL_ES[stage],
    metricoolScheduled: countMetricoolScheduled(active),
    hasMetricool: !!(cadence.metricoolBlogId && cadence.metricoolBlogId.trim()),
    nextPublish: findNextQueuePublish(active, cadence),
    nextNewVideo: findNextNewVideoSlot(active.length, cadence),
    videos: items,
  }
}
