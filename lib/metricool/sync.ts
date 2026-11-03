import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerConfig } from '@/lib/metricool/post'
import { getScheduledPosts } from '@/lib/metricool/scheduler'
import { type SyncIdeaRef } from '@/lib/utils/metricool-sync-core'
import {
  reconcilePostedIdeas,
  type ReconcileOutcome,
  type ReconcileRow,
} from '@/lib/utils/metricool-reconcile-core'
import { ideaCalendarDatePatches, unverifiedClientsForFailedBlogs } from '@/lib/metricool/calendar-pull-core'

export interface MetricoolSyncResult {
  updated: number
  checked: number
  error?: string
  /** Ideas whose publish_date was moved onto the Metricool Puerto Rico day. */
  datesUpdated?: number
  /** Clients whose Metricool profile failed this pull — keep them visible as sin verificar. */
  unverifiedClients?: { id: string; name: string }[]
  /** Cuántos envíos cayeron en cada desenlace. */
  counts?: Record<ReconcileOutcome, number>
  /** Envíos cuyo post ya no existe en Metricool: hay que republicarlos o cerrarlos a mano. */
  missing?: ReconcileRow[]
}

/**
 * Pull each Metricool post's real status and move the matching dashboard card to
 * 'publicada' once Metricool actually published it (every target network live).
 * Also copies the Metricool Puerto Rico day onto linked ideas so /calendar
 * matches the live publications calendar. Idempotent and best-effort.
 *
 * Runs with the service-role client so it works the same from a cron route or an
 * on-view trigger, and isn't filtered by RLS. Never writes back to Metricool.
 */
export async function runMetricoolPublishedSync(): Promise<MetricoolSyncResult> {
  const base = getServerConfig()
  if (!base) return { updated: 0, checked: 0, error: 'Metricool no está configurado.' }

  const supabase = createAdminClient()
  if (!supabase) return { updated: 0, checked: 0, error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' }

  // Ideas already sent to Metricool but not yet published/discarded in the board.
  const { data: ideas, error } = await supabase
    .from('content_ideas')
    .select('id, metricool_post_id, metricool_uuid, status, publish_date')
    .not('metricool_post_id', 'is', null)
    .not('status', 'in', '(publicada,descartada)')
  if (error) return { updated: 0, checked: 0, error: error.message }
  if (!ideas || ideas.length === 0) return { updated: 0, checked: 0 }

  // Query every active client's blog plus the global default (a post lives under
  // its client's blog id, not necessarily the default one).
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, metricool_blog_id')
    .not('metricool_blog_id', 'is', null)
    .eq('status', 'active')
  const blogIds = new Set<string>([base.blogId])
  for (const c of clients ?? []) {
    const b = (c.metricool_blog_id as string | null)?.trim()
    if (b) blogIds.add(b)
  }

  // Ventana: una de 45 días dejaba huérfano para siempre lo que no casara a
  // tiempo. Se abre hacia atrás un año y hacia adelante 90 días — el scheduler
  // lista por fecha DE PUBLICACIÓN, así que un post programado a futuro no
  // aparece en una ventana que termina "ahora".
  const now = new Date()
  const start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
  const end = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
  const startStr = start.toISOString().slice(0, 19)
  const endStr = end.toISOString().slice(0, 19)

  const found: Array<{ id: number; uuid?: string | null; draft?: boolean | null; providers?: Array<{ status?: string | null }> | null; publicationDate?: { dateTime?: string | null; timezone?: string | null } | null }> = []
  const failedBlogs: string[] = []
  const blogList = Array.from(blogIds)
  const lookups = await Promise.allSettled(
    blogList.map(async (blogId) => {
      const posts = await getScheduledPosts({ ...base, blogId }, startStr, endStr)
      return posts
    }),
  )
  lookups.forEach((result, index) => {
    if (result.status === 'fulfilled') found.push(...result.value)
    else failedBlogs.push(blogList[index])
  })
  const lookupComplete = failedBlogs.length === 0
  const unverifiedClients = unverifiedClientsForFailedBlogs(
    (clients ?? []).map((client) => ({
      id: client.id,
      name: client.name,
      metricool_blog_id: (client.metricool_blog_id as string | null)?.trim() || null,
    })),
    failedBlogs,
  )

  const recon = reconcilePostedIdeas(ideas as SyncIdeaRef[], found, lookupComplete)
  const toMark = recon.toMarkPublished
  if (recon.missing.length > 0) {
    console.warn(
      `runMetricoolPublishedSync: ${recon.missing.length} envíos ya no existen en Metricool`,
      recon.missing.map((m) => m.postId),
    )
  }

  let updated = 0
  if (toMark.length) {
    const { error: updErr } = await supabase
      .from('content_ideas')
      .update({ status: 'publicada' })
      .in('id', toMark)
    if (updErr) return { updated: 0, checked: ideas.length, error: updErr.message, counts: recon.counts, unverifiedClients }

    // Close the loop: the DB trigger `sync_idea_status_from_task` propagates
    // task → idea, not the reverse. We just marked these ideas 'publicada'
    // directly, so push their linked production_tasks to 'publicado' too —
    // otherwise the calendar chip stays stuck on its old status. Best-effort:
    // a failure here must not turn the idea sync itself into an error.
    const { error: taskUpdErr } = await supabase
      .from('production_tasks')
      .update({ status: 'publicado' })
      .in('idea_id', toMark)
      .neq('status', 'publicado')
    if (taskUpdErr) {
      console.error('runMetricoolPublishedSync: failed to sync production_tasks status', taskUpdErr.message)
    }
    updated = toMark.length
  }

  const patches = ideaCalendarDatePatches(
    ideas.map((idea) => ({
      id: idea.id,
      metricool_post_id: idea.metricool_post_id,
      metricool_uuid: idea.metricool_uuid,
      publish_date: idea.publish_date,
    })),
    found,
  )
  let datesUpdated = 0
  if (patches.length) {
    const byDate = new Map<string, string[]>()
    for (const patch of patches) {
      const ids = byDate.get(patch.publish_date) ?? []
      ids.push(patch.id)
      byDate.set(patch.publish_date, ids)
    }
    for (const [publish_date, ids] of byDate) {
      const { error: dateErr } = await supabase.from('content_ideas').update({ publish_date }).in('id', ids)
      if (dateErr) {
        console.error('runMetricoolPublishedSync: failed to sync calendar dates', dateErr.message)
        continue
      }
      datesUpdated += ids.length
    }
  }

  return {
    updated,
    checked: ideas.length,
    datesUpdated,
    unverifiedClients,
    counts: recon.counts,
    missing: recon.missing,
  }
}
