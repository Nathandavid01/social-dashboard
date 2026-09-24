import { ideaHasEntregasEditedVideo, type VideoProviderRef } from '@/lib/utils/entregas-delivery'

type ReciboIdea = {
  id: string
  client_id: string
  status: string
  videos?: VideoProviderRef[] | null
}

/**
 * Recibo lists each AI client's edited Entregas cut.
 * Ideas with no edited file stay off the board so a client with a backlog
 * of unshot ideas does not bury the cuts that were just uploaded.
 */
export function reciboBoardIdeas<T extends ReciboIdea>(ideas: T[], aiClientIds: Iterable<string>): T[] {
  const ids = new Set(aiClientIds)
  return ideas.filter(
    (idea) => ids.has(idea.client_id) && idea.status !== 'descartada' && ideaHasEntregasEditedVideo(idea),
  )
}
