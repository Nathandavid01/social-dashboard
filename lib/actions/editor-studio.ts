'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  currentUserHas,
  getEffectiveRole,
  getEffectiveUserId,
  requirePermission,
} from '@/lib/auth/server'
import { ideaTitleFromUpload } from '@/lib/pipeline/banco-direct-upload'
import type { IdeaApprovalStatus } from '@/lib/supabase/types'
import { generateIdeaCaption } from '@/lib/actions/idea-captions'
import { getMyEditorClients } from '@/lib/actions/recording-editors'
import { createDraftPost } from '@/lib/metricool/post'
import { checkVideoPlayable } from '@/lib/integrations/video-health'
import { r2PublicUrl } from '@/lib/integrations/r2'
import { entregasR2PublicUrl } from '@/lib/integrations/entregas-r2'
import { logIdeaActivity } from '@/lib/utils/idea-activity'
import { resolvePlatforms } from '@/lib/utils/idea-posting-core'
import { isPrimerRoundClientId, PRIMER_ROUND_CLIENT_ID } from '@/lib/primer-round/constants'
import { primerRoundCollabLabels } from '@/lib/primer-round/collabs'
import { primerRoundSoonScheduleIso } from '@/lib/primer-round/studio'
import type { PrimerRoundPieceKind } from '@/lib/primer-round/caption-template'
import { EDITOR_STUDIO_MAX_BYTES, EDITOR_STUDIO_UPLOAD_LIMITS } from '@/lib/estudio/upload-limit'
import { resolveStudioCollaborators } from '@/lib/estudio/collabs'
import { editorStudioDraftReadiness, pickStudioCaption } from '@/lib/estudio/draft-readiness'

export type EditorStudioClient = {
  id: string
  name: string
  logoUrl: string | null
  blogId: string | null
  platforms: string[]
  isPrimerRound: boolean
}

export type EditorStudioPayload = {
  clients: EditorStudioClient[]
  primerRoundCollabs: Array<{ username: string; label: string }>
  maxUploadBytes: number
  uploadLimits: typeof EDITOR_STUDIO_UPLOAD_LIMITS
}

async function requireEditorStudioAccess(): Promise<void> {
  await requirePermission('metricool.draft')
  const canUpload = await currentUserHas('video.upload')
  const canCaption = await currentUserHas('captions.use')
  if (!canUpload || !canCaption) {
    throw new Error('Acceso denegado (hace falta subir video y usar captions)')
  }
}

function mapClientRow(row: {
  id: string
  name: string
  logo_url?: string | null
  metricool_blog_id?: string | null
  platforms?: string[] | null
  default_platforms?: string[] | null
}): EditorStudioClient {
  return {
    id: row.id,
    name: row.name,
    logoUrl: row.logo_url ?? null,
    blogId: (row.metricool_blog_id ?? '').trim() || null,
    platforms: resolvePlatforms(row.platforms, row.default_platforms),
    isPrimerRound: isPrimerRoundClientId(row.id),
  }
}

async function loadStudioClients(): Promise<{ clients: EditorStudioClient[]; error?: string }> {
  const supabase = await createClient()
  const role = await getEffectiveRole()
  const select =
    'id, name, logo_url, metricool_blog_id, platforms, default_platforms, status' as const

  if (role === 'owner' || role === 'supervisor') {
    const { data, error } = await supabase
      .from('clients')
      .select(select)
      .eq('status', 'active')
      .order('name')
    if (error) return { clients: [], error: error.message }
    return { clients: (data ?? []).map(mapClientRow) }
  }

  const mine = await getMyEditorClients()
  if (mine.error && mine.clients.length === 0) return { clients: [], error: mine.error }
  const ids = new Set(mine.clients.map((c) => c.id))
  ids.add(PRIMER_ROUND_CLIENT_ID)

  const { data, error } = await supabase
    .from('clients')
    .select(select)
    .eq('status', 'active')
    .in('id', [...ids])
    .order('name')
  if (error) return { clients: [], error: error.message }
  return { clients: (data ?? []).map(mapClientRow) }
}

export async function getEditorStudio(): Promise<{ studio?: EditorStudioPayload; error?: string }> {
  try {
    await requireEditorStudioAccess()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const loaded = await loadStudioClients()
  if (loaded.error) return { error: loaded.error }

  return {
    studio: {
      clients: loaded.clients,
      primerRoundCollabs: primerRoundCollabLabels(),
      maxUploadBytes: EDITOR_STUDIO_MAX_BYTES,
      uploadLimits: EDITOR_STUDIO_UPLOAD_LIMITS,
    },
  }
}

export async function createEditorStudioIdea(input: {
  clientId: string
  fileName?: string | null
  title?: string | null
}): Promise<{ ideaId?: string; title?: string; error?: string }> {
  try {
    await requireEditorStudioAccess()
    await requirePermission('video.upload')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const clientId = input.clientId?.trim()
  if (!clientId) return { error: 'Elige un cliente' }

  const loaded = await loadStudioClients()
  if (loaded.error) return { error: loaded.error }
  const client = loaded.clients.find((c) => c.id === clientId)
  if (!client) return { error: 'Ese cliente no está en tu lista' }

  const title = ideaTitleFromUpload(input.title, [{ name: input.fileName ?? '' }])
  if (!title) return { error: 'Ponle un título al video (o sube un archivo con nombre)' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('content_ideas')
    .insert({
      client_id: clientId,
      content_type: 'R',
      title,
      status: 'producida',
      approval_status: 'pending' satisfies IdeaApprovalStatus,
      created_by: user?.id ?? null,
    })
    .select('id, title')
    .single()

  if (error || !data) return { error: error?.message ?? 'No se pudo crear la idea' }

  await logIdeaActivity(supabase, {
    ideaId: data.id as string,
    action: 'video_uploaded',
    metadata: { source: 'editor-studio' },
  })

  return { ideaId: data.id as string, title: (data.title as string) || title }
}

export async function generateEditorStudioCaption(input: {
  ideaId: string
  videoId: string
  pieceKind?: PrimerRoundPieceKind | null
  feedback?: string | null
  previousCaption?: string | null
}): Promise<{ caption?: string; visualSummary?: string | null; error?: string }> {
  try {
    await requireEditorStudioAccess()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const ideaId = input.ideaId?.trim()
  const videoId = input.videoId?.trim()
  if (!ideaId) return { error: 'Falta la idea' }
  if (!videoId) return { error: 'Falta el video de esta subida. No se usa otro archivo.' }

  const captionRes = await generateIdeaCaption(ideaId, {
    videoId,
    pieceKind: input.pieceKind ?? null,
    feedback: input.feedback ?? null,
    previousCaption: input.previousCaption ?? null,
  })
  if (captionRes.error) return { error: captionRes.error, caption: captionRes.caption }

  const supabase = await createClient()
  const { data: analysis } = await supabase
    .from('content_idea_video_analysis')
    .select('visual_summary')
    .eq('video_id', videoId)
    .maybeSingle()

  return {
    caption: captionRes.caption,
    visualSummary: (analysis?.visual_summary as string | null) ?? null,
  }
}

export async function pushEditorStudioDraft(input: {
  ideaId: string
  videoId: string
  caption?: string | null
  includeCollabs?: boolean
  collabUsernames?: string[] | null
}): Promise<{ ok?: true; metricoolPostId?: number | null; error?: string }> {
  try {
    await requireEditorStudioAccess()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const ideaId = input.ideaId?.trim()
  const videoId = input.videoId?.trim()
  if (!ideaId) return { error: 'Falta la idea' }
  if (!videoId) return { error: 'Falta el video de esta subida. No se usa otro archivo.' }

  const supabase = await createClient()
  const { data: idea } = await supabase
    .from('content_ideas')
    .select(
      'id, client_id, status, published_at, metricool_post_id, posted_at, generated_caption, caption_draft, content_type, client:clients(id, metricool_blog_id, platforms, default_platforms)',
    )
    .eq('id', ideaId)
    .maybeSingle()
  if (!idea) return { error: 'Idea no encontrada' }

  const loaded = await loadStudioClients()
  if (loaded.error) return { error: loaded.error }
  const clientId = (idea.client_id as string | null) ?? null
  if (!clientId || !loaded.clients.some((c) => c.id === clientId)) {
    return { error: 'Ese cliente no está en tu lista' }
  }

  const { data: video } = await supabase
    .from('content_idea_videos')
    .select('id, drive_file_id, storage_provider, kind, status')
    .eq('id', videoId)
    .eq('idea_id', ideaId)
    .eq('kind', 'edited')
    .not('status', 'in', '(archived,failed)')
    .maybeSingle()
  if (!video?.drive_file_id) {
    return { error: 'Falta el video de esta subida. No se usa otro archivo.' }
  }

  const caption = pickStudioCaption(
    idea.generated_caption as string | null,
    idea.caption_draft as string | null,
    input.caption,
  )
  const client = (idea.client ?? {}) as {
    metricool_blog_id?: string | null
    platforms?: string[] | null
    default_platforms?: string[] | null
  }
  const blogId = client.metricool_blog_id?.trim() || null
  const ready = editorStudioDraftReadiness(
    {
      status: idea.status as string | null,
      published_at: idea.published_at as string | null,
      metricool_post_id: (idea.metricool_post_id as number | null) ?? null,
      posted_at: idea.posted_at as string | null,
      caption,
    },
    true,
    blogId,
  )
  if (!ready.ready) return { error: ready.reason }

  const publicUrl =
    video.storage_provider === 'entregas-r2'
      ? entregasR2PublicUrl(video.drive_file_id as string)
      : r2PublicUrl(video.drive_file_id as string)
  if (!publicUrl) {
    return { error: 'No se pudo obtener la URL pública del video editado (¿falta ENTREGAS_R2_PUBLIC_BASE_URL?)' }
  }

  const health = await checkVideoPlayable(publicUrl)
  if (!health.ok) {
    return { error: `El video no se puede reproducir desde su URL pública: ${health.reason}` }
  }

  await supabase
    .from('content_ideas')
    .update({ generated_caption: caption, caption_draft: caption })
    .eq('id', ideaId)

  const now = new Date().toISOString()
  const { data: claimed, error: claimErr } = await supabase
    .from('content_ideas')
    .update({ posting_started_at: now })
    .eq('id', ideaId)
    .is('metricool_post_id', null)
    .is('posting_started_at', null)
    .is('posted_at', null)
    .select('id')
  if (claimErr) return { error: claimErr.message }
  if (!claimed || claimed.length === 0) {
    return { error: 'Esta pieza ya tiene un envío en curso o un post en Metricool. Actualiza antes de reenviar.' }
  }

  const releaseClaim = async (postingError: string) => {
    await supabase
      .from('content_ideas')
      .update({ posting_started_at: null, posting_error: postingError })
      .eq('id', ideaId)
  }

  const platforms = resolvePlatforms(client.platforms, client.default_platforms)
  const collabs = resolveStudioCollaborators({
    clientId,
    includeCollabs: input.includeCollabs,
    usernames: input.collabUsernames,
  })
  const scheduledFor = primerRoundSoonScheduleIso(Date.now(), 24 * 60 * 60 * 1000)

  try {
    const res = await createDraftPost(caption, blogId!, platforms, undefined, scheduledFor, {
      mediaUrls: [publicUrl],
      autoPublish: false,
      contentType: (idea.content_type as string | null) ?? 'R',
      ...(collabs.length > 0 ? { instagramCollaborators: collabs } : {}),
    })
    const postId = res.data?.id ?? null
    const uuid = res.data?.uuid ?? null
    if (postId == null && !uuid) throw new Error('Metricool no devolvió un identificador de la publicación')

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
    }
    if (!recorded) {
      return {
        error: `Metricool creó el borrador ${postId ?? uuid ?? '(sin identificador)'}, pero no se pudo guardar en el dashboard. Verifica esa publicación en Metricool antes de volver a enviar.`,
        metricoolPostId: postId,
      }
    }

    const userId = await getEffectiveUserId()
    await logIdeaActivity(supabase, {
      ideaId,
      userId,
      action: 'posted_to_metricool',
      metadata: {
        draft: true,
        autoPublish: false,
        platforms,
        scheduledFor,
        metricoolPostId: postId,
        videoId,
        publicUrl,
        collabs: collabs.map((c) => c.username),
        source: 'editor-studio',
      },
    })

    revalidatePath('/estudio')
    revalidatePath('/primer-round')
    revalidatePath('/pipeline')
    revalidatePath('/entregas')
    return { ok: true, metricoolPostId: postId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al crear el borrador en Metricool'
    if (err instanceof Error && 'definitelyNotCreated' in err && err.definitelyNotCreated === true) {
      await releaseClaim(msg)
      return { error: msg }
    }
    const uncertain = `No se pudo confirmar el resultado del envío. Debes verificarlo en Metricool antes de reenviar. ${msg}`
    await supabase.from('content_ideas').update({ posting_error: uncertain }).eq('id', ideaId)
    return { error: uncertain }
  }
}
