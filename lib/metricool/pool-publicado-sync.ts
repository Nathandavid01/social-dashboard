import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerConfig } from '@/lib/metricool/post'
import { getScheduledPosts } from '@/lib/metricool/scheduler'
import {
  poolIdeasToMarkPublicado,
  publishedMetricoolPostIds,
  type PoolPublicadoSyncIdea,
  type MetricoolPublishedPostRef,
} from '@/lib/utils/pool-publicado-sync-core'

export interface PoolPublicadoSyncResult {
  updated: number
  checked: number
  error?: string
}

/**
 * Short job: read Metricool PUBLISHED for scheduled pool posts and set
 * Publicado. Idempotent. Does not create Metricool posts. Does not require
 * Recibo “Ya se posteó”.
 */
export async function runPoolPublicadoSync(): Promise<PoolPublicadoSyncResult> {
  const base = getServerConfig()
  if (!base) return { updated: 0, checked: 0, error: 'Metricool no está configurado.' }

  const supabase = createAdminClient()
  if (!supabase) return { updated: 0, checked: 0, error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' }

  const { data: ideas, error } = await supabase
    .from('content_ideas')
    .select('id, metricool_post_id, posted_at, status, published_at, manual_posted_status')
    .not('metricool_post_id', 'is', null)
    .not('status', 'in', '(publicada,descartada)')
  if (error) return { updated: 0, checked: 0, error: error.message }
  if (!ideas || ideas.length === 0) return { updated: 0, checked: 0 }

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

  const now = new Date()
  const start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
  const end = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
  const startStr = start.toISOString().slice(0, 19)
  const endStr = end.toISOString().slice(0, 19)

  const found: MetricoolPublishedPostRef[] = []
  const lookups = await Promise.allSettled(
    Array.from(blogIds).map(async (blogId) => {
      const posts = await getScheduledPosts({ ...base, blogId }, startStr, endStr)
      for (const p of posts) found.push(p)
    }),
  )
  void lookups

  const toMark = poolIdeasToMarkPublicado(
    ideas as PoolPublicadoSyncIdea[],
    publishedMetricoolPostIds(found),
  )
  if (toMark.length === 0) {
    return { updated: 0, checked: ideas.length }
  }

  const { error: updErr } = await supabase
    .from('content_ideas')
    .update({ status: 'publicada' })
    .in('id', toMark)
  if (updErr) return { updated: 0, checked: ideas.length, error: updErr.message }

  const { error: taskUpdErr } = await supabase
    .from('production_tasks')
    .update({ status: 'publicado' })
    .in('idea_id', toMark)
    .neq('status', 'publicado')
  if (taskUpdErr) {
    console.error('runPoolPublicadoSync: failed to sync production_tasks status', taskUpdErr.message)
  }

  return { updated: toMark.length, checked: ideas.length }
}
