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

/** Client + server: only mp4 (or video/* named .mp4) for the Primer Round CTA. */
export function assertPrimerRoundMp4(input: {
  fileName?: string | null
  contentType?: string | null
}): string | null {
  const name = (input.fileName ?? '').trim().toLowerCase()
  const type = (input.contentType ?? '').trim().toLowerCase()
  if (type && !isAllowedVideoUploadType(type)) {
    return 'Tipo de archivo no permitido. Sube un video (mp4).'
  }
  if (name && !name.endsWith('.mp4') && type !== 'video/mp4') {
    return 'Solo se acepta video mp4.'
  }
  if (!name && !type) return 'Falta el archivo de video.'
  return null
}
