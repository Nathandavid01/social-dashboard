import { isAgendadoIdea, isPublishedIdea } from '@/lib/utils/client-pool-state'
import type { VideoProviderRef } from '@/lib/utils/entregas-delivery'

export type ReciboQueueIdea = {
  id: string
  client_id: string
  status: string
  published_at?: string | null
  manual_posted_status?: string | null
  metricool_post_id?: number | null
  posted_at?: string | null
  staff_client_approval?: string | null
  client_review_status?: string | null
  entregas_review_status?: string | null
  videos?: VideoProviderRef[] | null
}

function hasEditedCut(idea: ReciboQueueIdea): boolean {
  return (idea.videos ?? []).some(
    (video) => video.kind === 'edited' && video.status !== 'archived' && video.status !== 'failed',
  )
}

/**
 * Recibo is the queue before the video leaves:
 * - still waiting for approval, or
 * - approved and still waiting to be posted or scheduled in Metricool.
 * A Metricool post id, a posted_at, or a published video has already left.
 * An idea with no edited file is not a video yet.
 */
export function belongsOnRecibo(idea: ReciboQueueIdea): boolean {
  if (idea.status === 'descartada') return false
  if (!hasEditedCut(idea)) return false
  if (isPublishedIdea(idea)) return false
  if (isAgendadoIdea(idea)) return false
  // Waiting for approval, or approved and still waiting to be posted or scheduled.
  return true
}

export function reciboBoardIdeas<T extends ReciboQueueIdea>(ideas: T[]): T[] {
  return ideas.filter(belongsOnRecibo)
}
