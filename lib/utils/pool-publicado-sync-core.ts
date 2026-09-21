import { isAgendadoIdea } from './client-pool-state'
import { isScheduledPostPublished } from './metricool-sync-core'

/**
 * Sync Publicado from Metricool for pool-scheduled videos.
 * Pure: no Metricool/Supabase. Never invents post ids.
 */

export interface PoolPublicadoSyncIdea {
  id: string
  metricool_post_id: number | null
  posted_at?: string | null
  status: string
  published_at?: string | null
  manual_posted_status?: string | null
}

export interface MetricoolPublishedPostRef {
  id: number
  draft?: boolean | null
  providers?: Array<{ status?: string | null }> | null
}

/** Metricool post ids that are live on every target network. */
export function publishedMetricoolPostIds(posts: MetricoolPublishedPostRef[]): number[] {
  return posts
    .filter((post) => isScheduledPostPublished({
      draft: Boolean(post.draft),
      providers: (post.providers ?? []).map((p, i) => ({
        network: 'unknown',
        id: String(i),
        status: p.status ?? '',
      })),
    }))
    .map((post) => post.id)
}

/**
 * Agendado pool videos whose Metricool post is PUBLISHED.
 * Already Publicado (published_at / status / Ya se posteó) is a no-op.
 * A video without metricool_post_id is never marked — we do not invent posts.
 */
export function poolIdeasToMarkPublicado(
  ideas: PoolPublicadoSyncIdea[],
  publishedPostIds: Iterable<number>,
): string[] {
  const published = new Set(publishedPostIds)
  return ideas
    .filter((idea) => isAgendadoIdea(idea))
    .filter((idea) => idea.metricool_post_id != null && published.has(idea.metricool_post_id))
    .map((idea) => idea.id)
}
