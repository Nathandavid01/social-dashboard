'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { createDraftPost } from '@/lib/metricool/post'
import { getR2PublicUrl } from '@/lib/actions/idea-videos-r2'
import { logIdeaActivity } from '@/lib/utils/idea-activity'
import { ideaPostReadiness, buildPublishDateTime, resolvePlatforms } from '@/lib/utils/idea-posting-core'

type Result = { ok?: true; error?: string; skipped?: string; metricoolPostId?: number | null }

/** Emergency off-switch for the auto-on-approval behavior (manual button still works). */
const AUTOPOST_ON_APPROVAL_DISABLED = process.env.METRICOOL_AUTOPOST_ON_APPROVAL === 'false'

/**
 * Manual "Publicar a Metricool" — gated by `posting.publish`. Publishes a
 * fully-ready idea (caption + edited video + approved) on its planned date.
 */
export async function publishIdeaToMetricool(ideaId: string): Promise<Result> {
  try {
    await requirePermission('posting.publish')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return runIdeaPost(supabase, ideaId, user?.id ?? null)
}

/**
 * Best-effort auto-post triggered when an idea is approved. NEVER throws —
 * approval must succeed even if Metricool fails. Honors the
 * METRICOOL_AUTOPOST_ON_APPROVAL=false kill switch. Idempotent: a no-op if the
 * idea isn't fully ready or was already posted.
 */
export async function maybeAutoPostIdea(ideaId: string): Promise<void> {
  if (AUTOPOST_ON_APPROVAL_DISABLED) return
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await runIdeaPost(supabase, ideaId, user?.id ?? null)
  } catch {
    /* swallow — approval already committed; the failure is recorded on the row */
  }
}

/** Core publish routine shared by the manual button and the on-approval hook. */
async function runIdeaPost(
  supabase: SupabaseClient,
  ideaId: string,
  userId: string | null,
): Promise<Result> {
  const { data: idea } = await supabase
    .from('content_ideas')
    .select(
      'id, title, generated_caption, status, approval_status, published_at, publish_date, metricool_post_id, client:clients(metricool_blog_id, platforms, default_platforms, posting_time)',
    )
    .eq('id', ideaId)
    .single()
  if (!idea) return { error: 'Idea no encontrada' }

  // Most-recent non-archived edited video in R2 (the thing we attach).
  const { data: edited } = await supabase
    .from('content_idea_videos')
    .select('id')
    .eq('idea_id', ideaId)
    .eq('kind', 'edited')
    .eq('storage_provider', 'r2')
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const readiness = ideaPostReadiness(
    {
      approval_status: idea.approval_status as string | null,
      generated_caption: idea.generated_caption as string | null,
      status: idea.status as string | null,
      published_at: idea.published_at as string | null,
      metricool_post_id: (idea.metricool_post_id as number | null) ?? null,
    },
    !!edited,
  )
  if (!readiness.ready) return { skipped: readiness.reason }

  const client = (idea.client ?? {}) as {
    metricool_blog_id?: string | null
    platforms?: string[] | null
    default_platforms?: string[] | null
    posting_time?: string | null
  }

  // Public, permanent URL for the edited video (only edited videos are public).
  const pub = await getR2PublicUrl((edited as { id: string }).id)
  if (pub.error || !pub.url) {
    const msg = pub.error ?? 'No se pudo obtener la URL pública del video editado'
    await supabase.from('content_ideas').update({ posting_error: msg }).eq('id', ideaId)
    return { error: msg }
  }

  const scheduledFor = buildPublishDateTime(idea.publish_date as string | null, client.posting_time)
  const platforms = resolvePlatforms(client.platforms, client.default_platforms)

  try {
    const res = await createDraftPost(
      idea.generated_caption as string,
      client.metricool_blog_id ?? undefined,
      platforms,
      undefined,
      scheduledFor,
      { mediaUrls: [pub.url], autoPublish: true },
    )
    const postId = res.data?.id ?? null
    const uuid = res.data?.uuid ?? null

    await supabase
      .from('content_ideas')
      .update({
        metricool_post_id: postId,
        metricool_uuid: uuid,
        posted_at: new Date().toISOString(),
        posting_error: null,
      })
      .eq('id', ideaId)

    await logIdeaActivity(supabase, {
      ideaId,
      userId,
      action: 'posted_to_metricool',
      metadata: { platforms, scheduledFor, autoPublish: true, metricoolPostId: postId },
    })

    revalidatePath('/pipeline')
    revalidatePath(`/produccion/idea/${ideaId}`)
    return { ok: true, metricoolPostId: postId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al publicar en Metricool'
    await supabase.from('content_ideas').update({ posting_error: msg }).eq('id', ideaId)
    return { error: msg }
  }
}
