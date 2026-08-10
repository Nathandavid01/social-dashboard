import type { IdeaWithPipeline } from '@/lib/supabase/types'
import { ideaStage } from '@/lib/utils/content-batches'

/** Video is in the pipeline "Raw video" column — caption saved, waiting for raw footage. */
export function isIdeaReadyToRecord(
  idea: Pick<
    IdeaWithPipeline,
    'status' | 'hook' | 'visual_brief' | 'generated_caption' | 'approval_status' | 'published_at'
  >,
): boolean {
  if (idea.status === 'descartada') return false
  return ideaStage(idea as IdeaWithPipeline) === 'video'
}

export function countIdeasReadyToRecord(ideas: IdeaWithPipeline[], clientId?: string): number {
  return ideas.filter((i) => (!clientId || i.client_id === clientId) && isIdeaReadyToRecord(i)).length
}

export function ideasReadyToRecord(ideas: IdeaWithPipeline[], clientId: string): IdeaWithPipeline[] {
  return ideas.filter((i) => i.client_id === clientId && isIdeaReadyToRecord(i))
}
