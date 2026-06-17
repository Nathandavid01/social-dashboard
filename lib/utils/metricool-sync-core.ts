import type { ScheduledPost } from '@/lib/metricool/scheduler'

/**
 * Pure logic for syncing Metricool publish status back to the dashboard board.
 * Kept out of the `'use server'` action so it's unit-testable without Metricool
 * or Supabase.
 */

/**
 * A Metricool post counts as PUBLISHED for the dashboard when it is not a draft
 * and every target network has actually published it. A pending/error/partial
 * post is not yet "live everywhere", so we leave the card where it is.
 */
export function isScheduledPostPublished(post: Pick<ScheduledPost, 'draft' | 'providers'>): boolean {
  if (post.draft) return false
  const providers = post.providers ?? []
  return providers.length > 0 && providers.every((p) => p.status === 'PUBLISHED')
}

export interface SyncIdeaRef {
  id: string
  metricool_post_id: number | null
  status: string
}

/**
 * Which dashboard ideas should move to 'publicada': those whose Metricool post
 * id is in the published set and that aren't already published or discarded.
 */
export function ideasToMarkPublished(ideas: SyncIdeaRef[], publishedPostIds: Iterable<number>): string[] {
  const published = new Set(publishedPostIds)
  return ideas
    .filter((i) => i.metricool_post_id != null && published.has(i.metricool_post_id))
    .filter((i) => i.status !== 'publicada' && i.status !== 'descartada')
    .map((i) => i.id)
}
