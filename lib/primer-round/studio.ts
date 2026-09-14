/**
 * Bucket Primer Round ideas into the studio lanes:
 * bank (crudos) / ideas / in-edit / review.
 * Also: upload CTA helpers for the simplified /primer-round UI.
 */

import { isAllowedVideoUploadType } from '@/lib/utils/video-upload-guard'

export type StudioLane = 'ideas' | 'bank' | 'editing' | 'review' | 'ready' | 'other'

export interface StudioIdeaRef {
  id: string
  title: string
  status: string | null
  approval_status: string | null
  metricool_post_id?: number | null
  hasEditedVideo?: boolean
  hasRawVideo?: boolean
}

export function studioLaneFor(idea: StudioIdeaRef): StudioLane {
  if (idea.status === 'descartada') return 'other'
  if (idea.metricool_post_id != null) return 'other'
  const approval = idea.approval_status ?? 'pending'
  if (approval === 'submitted' || approval === 'revision_needed') return 'review'
  if (approval === 'approved') return 'ready'
  if (idea.status === 'grabada' || idea.hasRawVideo) return 'bank'
  if (idea.status === 'producida' || idea.hasEditedVideo) return 'editing'
  if (idea.status === 'idea' || idea.status === 'asignada') return 'ideas'
  return 'other'
}

/** Unpublished studio upload waiting for Eric to accept or give feedback. */
export type PendingPrimerRoundRef = {
  id: string
  status: string | null
  metricool_post_id?: number | null
  hasEditedVideo?: boolean
  /** True when created from /primer-round (activity source=primer-round-studio). */
  studioUpload?: boolean
  editedUploadedAt?: string | null
}

/**
 * Latest Primer Round movie that still needs Accept / feedback.
 * Prefers studio-marked uploads so a leftover pipeline idea is not sealed by mistake.
 */
export function pickPendingPrimerRoundPiece<T extends PendingPrimerRoundRef>(ideas: T[]): T | null {
  const live = ideas.filter(
    (idea) => idea.status !== 'descartada' && idea.metricool_post_id == null && !!idea.hasEditedVideo,
  )
  if (live.length === 0) return null
  const marked = live.filter((idea) => idea.studioUpload === true)
  const pool = marked.length > 0 ? marked : live
  return (
    [...pool].sort((a, b) => (b.editedUploadedAt ?? '').localeCompare(a.editedUploadedAt ?? ''))[0] ??
    null
  )
}

/** Naive PR datetime far enough ahead for Metricool (lead + 1 min). */
export function primerRoundSoonScheduleIso(
  nowMs = Date.now(),
  leadMs = 6 * 60 * 1000,
): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Puerto_Rico',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(nowMs + leadMs))
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  const hour = String(Number(get('hour')) % 24).padStart(2, '0')
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`
}

export function groupStudioIdeas<T extends StudioIdeaRef>(ideas: T[]): Record<StudioLane, T[]> {
  const empty: Record<StudioLane, T[]> = {
    ideas: [],
    bank: [],
    editing: [],
    review: [],
    ready: [],
    other: [],
  }
  for (const idea of ideas) {
    empty[studioLaneFor(idea)].push(idea)
  }
  return empty
}

/** Deep links into existing flows, scoped when the destination supports ?c= */
export function primerRoundCtas(clientId: string) {
  return {
    ideas: `/escribir-ideas?c=${encodeURIComponent(clientId)}`,
    bank: '/banco',
    pipeline: '/pipeline',
    editing: '/pipeline',
    review: '/revision',
    onsite: '/onsite',
    recording: '/recording-calendar',
    client: `/clients/${clientId}`,
  } as const
}

const PRIMER_ROUND_EXTS = ['.mp4', '.mov'] as const
const PRIMER_ROUND_TYPES = new Set(['video/mp4', 'video/quicktime'])

/** Same MIME for picker, PUT, presign and register (Safari often sends an empty type). */
export function primerRoundUploadContentType(input: {
  fileName?: string | null
  contentType?: string | null
}): string {
  const type = (input.contentType ?? '').trim().toLowerCase().split(';')[0]!
  if (type.startsWith('video/') && type.length > 'video/'.length) return type
  const name = (input.fileName ?? '').trim().toLowerCase()
  if (name.endsWith('.mov')) return 'video/quicktime'
  if (name.endsWith('.webm')) return 'video/webm'
  if (name.endsWith('.mp4')) return 'video/mp4'
  return type || 'video/mp4'
}

/** Client + server: mp4 or mov for the Primer Round CTA. */
export function assertPrimerRoundMp4(input: {
  fileName?: string | null
  contentType?: string | null
}): string | null {
  const name = (input.fileName ?? '').trim().toLowerCase()
  const type = (input.contentType ?? '').trim().toLowerCase().split(';')[0]!
  if (type && !isAllowedVideoUploadType(type)) {
    return 'Tipo de archivo no permitido. Sube un video (mp4 o mov).'
  }
  const extOk = PRIMER_ROUND_EXTS.some((ext) => name.endsWith(ext))
  const typeOk = PRIMER_ROUND_TYPES.has(type)
  if (name && !extOk && !typeOk) {
    return 'Solo se acepta video mp4 o mov.'
  }
  if (!name && !type) return 'Falta el archivo de video.'
  return null
}
