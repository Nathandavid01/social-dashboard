import { isAgendadoIdea, isPublishedIdea } from '@/lib/utils/client-pool-state'
import type { VideoProviderRef } from '@/lib/utils/entregas-delivery'
import { ERIC_IDS } from './upload-counts'

export { ERIC_IDS }

type ReciboVideo = VideoProviderRef & { uploaded_by?: string | null }

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
  videos?: ReciboVideo[] | null
}


function usableCut(video: ReciboVideo): boolean {
  return video.kind === 'edited' && video.status !== 'archived' && video.status !== 'failed'
}

function hasEditedCut(idea: ReciboQueueIdea): boolean {
  return (idea.videos ?? []).some(usableCut)
}

/**
 * A usable edited cut that Eric uploaded (dashboard or terminal taller). Eric 2026-09-24: «quiero que puedas
 * poner en recibo los videos que yo edito aunque el cliente sea de un editor».
 */
export function hasEricCut(idea: ReciboQueueIdea): boolean {
  return (idea.videos ?? []).some((video) => usableCut(video) && !!video.uploaded_by && ERIC_IDS.has(video.uploaded_by))
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

/** The AI clients' waiting cuts, plus any waiting cut Eric uploaded (whatever the client's editor). */
export function reciboBoardIdeas<T extends ReciboQueueIdea>(ideas: T[], aiClientIds: Iterable<string>): T[] {
  const ids = new Set(aiClientIds)
  return ideas.filter((idea) => (ids.has(idea.client_id) || hasEricCut(idea)) && belongsOnRecibo(idea))
}
