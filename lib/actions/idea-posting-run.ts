import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { createDraftPost } from '@/lib/metricool/post'
import { r2PublicUrl } from '@/lib/integrations/r2'
import { checkVideoPlayable } from '@/lib/integrations/video-health'
import { logIdeaActivity } from '@/lib/utils/idea-activity'
import {
  ideaPostReadiness,
  buildPublishDateTime,
  resolvePlatforms,
  pickEditedVideoForPublish,
  type VideoWatchBoard,
} from '@/lib/utils/idea-posting-core'
import { validateScheduleOverride } from '@/lib/utils/publish-override'
import { entregasR2PublicUrl } from '@/lib/integrations/entregas-r2'

export type PostResult = { ok?: true; error?: string; skipped?: string; metricoolPostId?: number | null }

/**
 * Core publish routine shared by the manual button, the on-approval hook, and
 * the client-vote auto-post (which passes a service-role client, since the
 * public review link has no user session). Takes its Supabase client as an
 * argument precisely so the caller owns the privilege level.
 */
export async function runIdeaPost(
  supabase: SupabaseClient,
  ideaId: string,
  userId: string | null,
  /**
   * Naive "YYYY-MM-DDTHH:MM" chosen by hand on the Publicación card. Re-validated
   * here — the browser's copy of the rule is a convenience, not the authority.
   */
  scheduleOverride?: string | null,
  opts?: { videoFileId?: string | null; watchedOn?: VideoWatchBoard | null },
): Promise<PostResult> {
  // Before any DB work: a bad override must not burn the posting claim.
  let overrideIso: string | null = null
  if (scheduleOverride) {
    const checked = validateScheduleOverride(scheduleOverride)
    if (!checked.ok) return { error: checked.error }
    overrideIso = checked.iso
  }

  const { data: idea } = await supabase
    .from('content_ideas')
    .select(
      'id, title, content_type, generated_caption, status, approval_status, published_at, publish_date, metricool_post_id, posted_at, client:clients(metricool_blog_id, platforms, default_platforms, posting_time)',
    )
    .eq('id', ideaId)
    .single()
  if (!idea) return { error: 'Idea no encontrada' }

  // All live edited files for THIS idea. Pick in JS so a leftover pipeline
  // cut from last week cannot beat this week's Entregas file just because
  // its uploaded_at is newer. See pickEditedVideoForPublish.
  const { data: editedRows, error: editedErr } = await supabase
    .from('content_idea_videos')
    .select('id, idea_id, drive_file_id, storage_provider, kind, status, uploaded_at')
    .eq('idea_id', ideaId)
    .eq('kind', 'edited')
    .in('storage_provider', ['r2', 'entregas-r2'])
    .neq('status', 'archived')

  const edited = pickEditedVideoForPublish(editedRows ?? [], {
    preferredId: opts?.videoFileId,
    ideaId,
    watchedOn: opts?.watchedOn,
  })

  // Un fallo al buscar el video NO puede leerse como "no hay video": eso fue
  // exactamente lo que ocultó el bug de created_at durante todo este tiempo.
  if (editedErr) return { error: `No se pudo leer el video editado: ${editedErr.message}` }

  const client = (idea.client ?? {}) as {
    metricool_blog_id?: string | null
    platforms?: string[] | null
    default_platforms?: string[] | null
    posting_time?: string | null
  }
  // Trimmed client blog id — readiness REFUSES if blank, so we never fall back
  // to the global default account when auto-publishing a real post.
  const blogId = client.metricool_blog_id?.trim()

  const readiness = ideaPostReadiness(
    {
      approval_status: idea.approval_status as string | null,
      generated_caption: idea.generated_caption as string | null,
      status: idea.status as string | null,
      published_at: idea.published_at as string | null,
      metricool_post_id: (idea.metricool_post_id as number | null) ?? null,
      posted_at: (idea.posted_at as string | null) ?? null,
    },
    !!edited,
    blogId,
  )
  if (!readiness.ready) return { skipped: readiness.reason }

  // ── Atomic claim: the real guard against double-posting. Sets posting_started_at
  // ONLY where metricool_post_id is null AND the slot is free or stale (>5 min, a
  // crashed prior attempt). If no row is claimed, another trigger already owns it
  // (approve + manual button, retries) — abort instead of posting twice. ──
  const staleBefore = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const { data: claimed, error: claimErr } = await supabase
    .from('content_ideas')
    .update({ posting_started_at: new Date().toISOString() })
    .eq('id', ideaId)
    .is('metricool_post_id', null)
    .or(`posting_started_at.is.null,posting_started_at.lt.${staleBefore}`)
    .select('id')
  if (claimErr) return { error: claimErr.message }
  if (!claimed || claimed.length === 0) return { skipped: 'Ya se publicó o hay una publicación en curso' }

  const releaseClaim = async (postingError: string) => {
    await supabase
      .from('content_ideas')
      .update({ posting_started_at: null, posting_error: postingError })
      .eq('id', ideaId)
  }

  // Public, permanent URL for the edited video. Only `edited` videos are ever
  // exposed publicly — the query above already constrains kind + provider, and
  // the Cloudflare Worker enforces the same `/edited/` restriction at the edge.
  const editedVideo = edited as { id: string; drive_file_id: string | null; storage_provider?: string }
  // El dominio público depende del bucket donde vive el archivo: usar el del
  // otro tablero devolvería un 404 que Metricool reporta como "media inválida".
  const publicUrl = !editedVideo.drive_file_id
    ? null
    : editedVideo.storage_provider === 'entregas-r2'
      ? entregasR2PublicUrl(editedVideo.drive_file_id)
      : r2PublicUrl(editedVideo.drive_file_id)
  if (!publicUrl) {
    const msg = 'No se pudo obtener la URL pública del video editado (¿falta R2_PUBLIC_BASE_URL?)'
    await releaseClaim(msg)
    return { error: msg }
  }
  const pub = { url: publicUrl }

  // Pre-flight the public video the way Metricool's player will (a Range
  // request expecting 206). Block here instead of silently sending a URL that
  // makes the preview spin forever. See lib/integrations/video-health.ts.
  const health = await checkVideoPlayable(pub.url)
  if (!health.ok) {
    const msg = `El video no se puede reproducir desde su URL pública: ${health.reason}`
    await releaseClaim(msg)
    return { error: msg }
  }

  // A hand-picked time wins over the planned date + the client's posting_time.
  const scheduledFor = overrideIso ?? buildPublishDateTime(idea.publish_date as string | null, client.posting_time)
  const platforms = resolvePlatforms(client.platforms, client.default_platforms)

  try {
    const res = await createDraftPost(
      idea.generated_caption as string,
      blogId,
      platforms,
      undefined,
      scheduledFor,
      { mediaUrls: [pub.url], autoPublish: true, contentType: (idea.content_type as string | null) ?? null },
    )
    const postId = res.data?.id ?? null
    const uuid = res.data?.uuid ?? null

    // The Metricool post EXISTS now — this bookkeeping must stick or a stale-claim
    // retry (>5 min) could post twice. Retry the UPDATE; on total failure DO NOT
    // release the claim (posting_started_at keeps blocking retries for 5 min and
    // the posted_at readiness backstop covers rows where it did persist).
    let recorded = false
    for (let attempt = 0; attempt < 3 && !recorded; attempt++) {
      const { error: recordErr } = await supabase
        .from('content_ideas')
        .update({
          metricool_post_id: postId,
          metricool_uuid: uuid,
          posted_at: new Date().toISOString(),
          posting_error: null,
        })
        .eq('id', ideaId)
      recorded = !recordErr
      if (!recorded) console.error(`[idea-posting] bookkeeping attempt ${attempt + 1} failed for ${ideaId}:`, recordErr?.message)
    }

    await logIdeaActivity(supabase, {
      ideaId,
      userId,
      action: 'posted_to_metricool',
      metadata: {
        platforms,
        scheduledFor,
        scheduleOverridden: overrideIso != null,
        autoPublish: true,
        metricoolPostId: postId,
        videoId: editedVideo.id,
        videoKey: editedVideo.drive_file_id,
        storageProvider: editedVideo.storage_provider,
        publicUrl: pub.url,
      },
    })

    revalidatePath('/pipeline')
    revalidatePath('/video-reviews')
    revalidatePath(`/produccion/idea/${ideaId}`)
    return { ok: true, metricoolPostId: postId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al publicar en Metricool'
    await releaseClaim(msg)
    return { error: msg }
  }
}
