import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerConfig } from '@/lib/metricool/post'
import { getScheduledPosts } from '@/lib/metricool/scheduler'
import {
  isScheduledPostPublished,
  ideasToMarkPublished,
  type SyncIdeaRef,
} from '@/lib/utils/metricool-sync-core'

export interface MetricoolSyncResult {
  updated: number
  checked: number
  error?: string
}

/**
 * Pull each Metricool post's real status and move the matching dashboard card to
 * 'publicada' once Metricool actually published it (every target network live).
 * Setting status='publicada' fires the set_idea_published_at trigger, so the
 * card lands in the pipeline's Publication column with a published_at date — so
 * the team can see where each video ended up. Idempotent and best-effort.
 *
 * Runs with the service-role client so it works the same from a cron route or an
 * on-view trigger, and isn't filtered by RLS.
 */
export async function runMetricoolPublishedSync(): Promise<MetricoolSyncResult> {
  const base = getServerConfig()
  if (!base) return { updated: 0, checked: 0, error: 'Metricool no está configurado.' }

  const supabase = createAdminClient()
  if (!supabase) return { updated: 0, checked: 0, error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' }

  // Ideas already sent to Metricool but not yet published/discarded in the board.
  const { data: ideas, error } = await supabase
    .from('content_ideas')
    .select('id, metricool_post_id, status')
    .not('metricool_post_id', 'is', null)
    .not('status', 'in', '(publicada,descartada)')
  if (error) return { updated: 0, checked: 0, error: error.message }
  if (!ideas || ideas.length === 0) return { updated: 0, checked: 0 }

  // Query every active client's blog plus the global default (a post lives under
  // its client's blog id, not necessarily the default one).
  const { data: clients } = await supabase
    .from('clients')
    .select('metricool_blog_id')
    .not('metricool_blog_id', 'is', null)
    .eq('status', 'active')
  const blogIds = new Set<string>([base.blogId])
  for (const c of clients ?? []) {
    const b = (c.metricool_blog_id as string | null)?.trim()
    if (b) blogIds.add(b)
  }

  // Window: anything that could have just gone live — last 45 days through now.
  const end = new Date()
  const start = new Date(end.getTime() - 45 * 24 * 60 * 60 * 1000)
  const startStr = start.toISOString().slice(0, 19)
  const endStr = end.toISOString().slice(0, 19)

  const publishedIds = new Set<number>()
  await Promise.allSettled(
    Array.from(blogIds).map(async (blogId) => {
      const posts = await getScheduledPosts({ ...base, blogId }, startStr, endStr)
      for (const p of posts) if (isScheduledPostPublished(p)) publishedIds.add(p.id)
    }),
  )

  const toMark = ideasToMarkPublished(ideas as SyncIdeaRef[], publishedIds)
  if (toMark.length === 0) return { updated: 0, checked: ideas.length }

  const { error: updErr } = await supabase
    .from('content_ideas')
    .update({ status: 'publicada' })
    .in('id', toMark)
  if (updErr) return { updated: 0, checked: ideas.length, error: updErr.message }

  return { updated: toMark.length, checked: ideas.length }
}
