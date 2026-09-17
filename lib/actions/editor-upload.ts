'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { currentUserHas, getEffectiveUserId, requirePermission } from '@/lib/auth/server'
import { ideaTitleFromUpload } from '@/lib/pipeline/banco-direct-upload'
import type { ContentIdeaType, IdeaApprovalStatus } from '@/lib/supabase/types'
import { generateIdeaCaption } from '@/lib/actions/idea-captions'
import { getMyEditorClients } from '@/lib/actions/recording-editors'
import { createDraftPost } from '@/lib/metricool/post'
import { checkVideoPlayable } from '@/lib/integrations/video-health'
import { r2PublicUrl } from '@/lib/integrations/r2'
import { entregasR2PublicUrl } from '@/lib/integrations/entregas-r2'
import { resolvePlatforms } from '@/lib/utils/idea-posting-core'
import { logIdeaActivity } from '@/lib/utils/idea-activity'
import { isPrimerRoundClientId, PRIMER_ROUND_BLOG_ID } from '@/lib/primer-round/constants'
import { primerRoundCollabLabels } from '@/lib/primer-round/collabs'
import { normalizePrimerRoundCaption } from '@/lib/primer-round/caption-template'
import { assertPrimerRoundMp4 } from '@/lib/primer-round/studio'
import { EDITOR_UPLOAD_MAX_BYTES, assertEditorUploadSize } from '@/lib/editor-upload/limits'
import { editorDraftReadiness } from '@/lib/editor-upload/draft-readiness'
import { resolveEditorUploadCollaborators } from '@/lib/editor-upload/collabs'
import {
  resolvePrimerRoundPieceKind,
  type PrimerRoundPieceKind,
} from '@/lib/editor-upload/piece-kind'
import type { VideoAnalysisFindings } from '@/lib/llm/video-analysis-core'

export type EditorUploadClient = {
  id: string
  name: string
  logoUrl: string | null
  blogId: string | null
  platforms: string[]
  isPrimerRound: boolean
}

export type EditorUploadStudioPayload = {
  clients: EditorUploadClient[]
  primerRoundCollabs: Array<{ username: string; label: string }>
  maxBytes: number
}

async function requireEditorUploadAccess(): Promise<void> {
  await requirePermission('metricool.draft')
}

function mapClient(row: {
  id: string
  name: string
  logo_url?: string | null
  metricool_blog_id?: string | null
  platforms?: string[] | null
  default_platforms?: string[] | null
}): EditorUploadClient {
  const isPrimerRound = isPrimerRoundClientId(row.id)
  const blogId =
    (row.metricool_blog_id as string | null)?.trim() || (isPrimerRound ? PRIMER_ROUND_BLOG_ID : null)
  return {
    id: row.id,
    name: row.name,
    logoUrl: row.logo_url ?? null,
    blogId,
    platforms: resolvePlatforms(row.platforms, row.default_platforms),
    isPrimerRound,
  }
}

export async function getEditorUploadStudio(): Promise<{
  studio?: EditorUploadStudioPayload
  error?: string
}> {
  try {
    await requireEditorUploadAccess()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()
  const canSeeAll = await currentUserHas('clients.read')
  let allowedIds: string[] | null = null
  if (!canSeeAll) {
    const mine = await getMyEditorClients()
    if (mine.error) return { error: mine.error }
    allowedIds = mine.clients.map((c) => c.id)
    if (allowedIds.length === 0) {
      return {
        studio: {
          clients: [],
          primerRoundCollabs: primerRoundCollabLabels(),
          maxBytes: EDITOR_UPLOAD_MAX_BYTES,
        },
      }
    }
  }

  let query = supabase
    .from('clients')
    .select('id, name, logo_url, metricool_blog_id, platforms, default_platforms')
    .eq('status', 'active')
    .order('name')
  if (allowedIds) query = query.in('id', allowedIds)
  const { data, error } = await query
  if (error) return { error: error.message }

  return {
    studio: {
      clients: (data ?? []).map(mapClient),
      primerRoundCollabs: primerRoundCollabLabels(),
      maxBytes: EDITOR_UPLOAD_MAX_BYTES,
    },
  }
}

async function assertClientAllowed(clientId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data: client } = await supabase
    .from('clients')
    .select('id, status')
    .eq('id', clientId)
    .maybeSingle()
  if (!client || client.status !== 'active') return 'Cliente no encontrado'
  if (await currentUserHas('clients.read')) return null
  const mine = await getMyEditorClients()
  if (mine.error) return mine.error
  if (!mine.clients.some((c) => c.id === clientId)) return 'Ese cliente no está asignado a ti'
  return null
}

async function loadPinnedEditedVideo(
  ideaId: string,
  videoId?: string | null,
): Promise<{ videoId?: string; key?: string; provider?: string | null; error?: string }> {
  const pinned = videoId?.trim()
  if (!pinned) return { error: 'Falta el video de esta subida. No se usa otro archivo.' }
  const supabase = await createClient()
  const { data: video } = await supabase
    .from('content_idea_videos')
    .select('id, drive_file_id, storage_provider')
    .eq('id', pinned)
    .eq('idea_id', ideaId)
    .eq('kind', 'edited')
    .not('status', 'in', '(archived,failed)')
    .maybeSingle()
  if (!video?.id) return { error: 'Este video no es el que acabas de subir. No se trabaja el archivo anterior.' }
  return {
    videoId: video.id as string,
    key: (video.drive_file_id as string | null) ?? undefined,
    provider: (video.storage_provider as string | null) ?? null,
  }
}

/** Create an idea so the browser can attach the edited mp4/mov. */
export async function createEditorUploadIdea(input: {
  clientId: string
  title?: string | null
  fileName?: string | null
  contentType?: ContentIdeaType | null
  sizeBytes?: number | null
}): Promise<{ ideaId?: string; title?: string; error?: string }> {
  try {
    await requireEditorUploadAccess()
    await requirePermission('video.upload')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const clientId = input.clientId?.trim()
  if (!clientId) return { error: 'Elige un cliente' }
  const sizeErr = assertEditorUploadSize(input.sizeBytes ?? 1)
  if (input.sizeBytes != null && sizeErr) return { error: sizeErr }
  const typeErr = assertPrimerRoundMp4({ fileName: input.fileName, contentType: null })
  if (input.fileName && typeErr) return { error: typeErr }

  const allowed = await assertClientAllowed(clientId)
  if (allowed) return { error: allowed }

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
      content_type: (input.contentType ?? 'R') satisfies ContentIdeaType,
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
    metadata: { source: 'editor-upload-studio' },
  })

  return { ideaId: data.id as string, title: (data.title as string) || title }
}

export async function runEditorUploadPipeline(input: {
  ideaId: string
  videoId: string
  pieceKind?: 'auto' | PrimerRoundPieceKind | null
}): Promise<{
  ok?: true
  caption?: string | null
  pieceKind?: PrimerRoundPieceKind | null
  overlayText?: string | null
  visualSummary?: string | null
  error?: string
}> {
  try {
    await requireEditorUploadAccess()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const ideaId = input.ideaId?.trim()
  if (!ideaId) return { error: 'Falta la idea' }

  const supabase = await createClient()
  const { data: idea } = await supabase
    .from('content_ideas')
    .select('id, client_id')
    .eq('id', ideaId)
    .maybeSingle()
  if (!idea) return { error: 'Idea no encontrada' }

  const allowed = await assertClientAllowed(idea.client_id as string)
  if (allowed) return { error: allowed }

  const pinned = await loadPinnedEditedVideo(ideaId, input.videoId)
  if (pinned.error || !pinned.videoId) return { error: pinned.error ?? 'Falta el video de esta subida.' }

  const { data: analysis } = await supabase
    .from('content_idea_video_analysis')
    .select('findings, visual_summary, status')
    .eq('video_id', pinned.videoId)
    .maybeSingle()
  const findings = analysis?.findings as VideoAnalysisFindings | null
  const overlayText = findings?.burned_captions?.text ?? null
  const visualSummary = (analysis?.visual_summary as string | null) ?? findings?.visual_summary ?? null

  const { data: videoRow } = await supabase
    .from('content_idea_videos')
    .select('name')
    .eq('id', pinned.videoId)
    .maybeSingle()

  const isPrimerRound = isPrimerRoundClientId(idea.client_id as string)
  const pieceKind = isPrimerRound
    ? resolvePrimerRoundPieceKind(input.pieceKind, {
        visualSummary,
        burnedOverlay: overlayText,
        fileName: (videoRow?.name as string | null) ?? null,
      })
    : null

  const captionRes = await generateIdeaCaption(ideaId, {
    videoId: pinned.videoId,
    primerRoundKind: pieceKind,
  })
  if (captionRes.error) {
    return {
      error: captionRes.error,
      caption: captionRes.caption,
      pieceKind,
      overlayText,
      visualSummary,
    }
  }

  const caption = isPrimerRound && captionRes.caption
    ? normalizePrimerRoundCaption(captionRes.caption, undefined, pieceKind ?? 'gfx')
    : captionRes.caption ?? null

  if (caption) {
    await supabase
      .from('content_ideas')
      .update({ caption_draft: caption, generated_caption: caption })
      .eq('id', ideaId)
  }

  return {
    ok: true,
    caption,
    pieceKind,
    overlayText,
    visualSummary,
  }
}

export async function reviseEditorUploadCaption(input: {
  ideaId: string
  videoId: string
  feedback: string
  previousCaption?: string | null
  pieceKind?: PrimerRoundPieceKind | null
}): Promise<{ caption?: string; pieceKind?: PrimerRoundPieceKind | null; error?: string }> {
  try {
    await requireEditorUploadAccess()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const ideaId = input.ideaId?.trim()
  const feedback = input.feedback.trim()
  if (!ideaId) return { error: 'Falta la idea' }
  if (!feedback) return { error: 'Escribe el feedback para la IA' }

  const pinned = await loadPinnedEditedVideo(ideaId, input.videoId)
  if (pinned.error || !pinned.videoId) return { error: pinned.error ?? 'Falta el video de esta subida.' }

  const supabase = await createClient()
  const { data: idea } = await supabase
    .from('content_ideas')
    .select('client_id')
    .eq('id', ideaId)
    .maybeSingle()
  if (!idea) return { error: 'Idea no encontrada' }
  const isPrimerRound = isPrimerRoundClientId(idea.client_id as string)
  const pieceKind = isPrimerRound ? (input.pieceKind ?? 'gfx') : null

  const captionRes = await generateIdeaCaption(ideaId, {
    videoId: pinned.videoId,
    feedback,
    previousCaption: input.previousCaption ?? null,
    primerRoundKind: pieceKind,
  })
  if (captionRes.error) return { error: captionRes.error, caption: captionRes.caption, pieceKind }

  const caption = isPrimerRound && captionRes.caption
    ? normalizePrimerRoundCaption(captionRes.caption, undefined, pieceKind ?? 'gfx')
    : captionRes.caption

  if (caption?.trim()) {
    await supabase
      .from('content_ideas')
      .update({ caption_draft: caption.trim(), generated_caption: caption.trim() })
      .eq('id', ideaId)
  }

  return { caption, pieceKind }
}

export async function saveEditorUploadCaption(input: {
  ideaId: string
  caption: string
  pieceKind?: PrimerRoundPieceKind | null
}): Promise<{ caption?: string; error?: string }> {
  try {
    await requireEditorUploadAccess()
    await requirePermission('captions.edit')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const ideaId = input.ideaId?.trim()
  const raw = input.caption.trim()
  if (!ideaId) return { error: 'Falta la idea' }
  if (!raw) return { error: 'Falta el caption' }

  const supabase = await createClient()
  const { data: idea } = await supabase
    .from('content_ideas')
    .select('client_id')
    .eq('id', ideaId)
    .maybeSingle()
  if (!idea) return { error: 'Idea no encontrada' }
  const allowed = await assertClientAllowed(idea.client_id as string)
  if (allowed) return { error: allowed }

  const caption = isPrimerRoundClientId(idea.client_id as string)
    ? normalizePrimerRoundCaption(raw, undefined, input.pieceKind ?? 'gfx')
    : raw

  const { error } = await supabase
    .from('content_ideas')
    .update({ caption_draft: caption, generated_caption: caption })
    .eq('id', ideaId)
  if (error) return { error: error.message }
  return { caption }
}

/**
 * Push to Metricool as a DRAFT. Never autoPublish.
 * Live only after a human accepts the draft in Metricool (Eric rule).
 */
export async function pushEditorUploadDraft(input: {
  ideaId: string
  videoId: string
  caption: string
  includeCollabs: boolean
  extraCollabUsernames?: string[]
  pieceKind?: PrimerRoundPieceKind | null
}): Promise<{ ok?: true; metricoolPostId?: number | null; error?: string }> {
  try {
    await requireEditorUploadAccess()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const ideaId = input.ideaId?.trim()
  const captionRaw = input.caption.trim()
  if (!ideaId) return { error: 'Falta la idea' }
  if (!captionRaw) return { error: 'Falta el caption' }

  const supabase = await createClient()
  const { data: idea } = await supabase
    .from('content_ideas')
    .select(
      'id, client_id, content_type, status, metricool_post_id, posted_at, generated_caption, caption_draft, client:clients(id, metricool_blog_id, platforms, default_platforms)',
    )
    .eq('id', ideaId)
    .maybeSingle()
  if (!idea) return { error: 'Idea no encontrada' }

  const clientId = idea.client_id as string
  const allowed = await assertClientAllowed(clientId)
  if (allowed) return { error: allowed }

  const pinned = await loadPinnedEditedVideo(ideaId, input.videoId)
  if (pinned.error || !pinned.videoId || !pinned.key) {
    return { error: pinned.error ?? 'Falta el video de esta subida.' }
  }

  const publicUrl =
    pinned.provider === 'entregas-r2' ? entregasR2PublicUrl(pinned.key) : r2PublicUrl(pinned.key)

  const rawClient = idea.client as
    | {
        metricool_blog_id?: string | null
        platforms?: string[] | null
        default_platforms?: string[] | null
      }
    | Array<{
        metricool_blog_id?: string | null
        platforms?: string[] | null
        default_platforms?: string[] | null
      }>
    | null
  const client = (Array.isArray(rawClient) ? rawClient[0] : rawClient) ?? {}
  const blogId =
    client.metricool_blog_id?.trim() || (isPrimerRoundClientId(clientId) ? PRIMER_ROUND_BLOG_ID : null)

  const caption = isPrimerRoundClientId(clientId)
    ? normalizePrimerRoundCaption(captionRaw, undefined, input.pieceKind ?? 'gfx')
    : captionRaw

  const ready = editorDraftReadiness({
    caption,
    hasVideo: true,
    publicUrl,
    blogId,
    metricoolPostId: (idea.metricool_post_id as number | null) ?? null,
    postedAt: (idea.posted_at as string | null) ?? null,
    status: idea.status as string | null,
  })
  if (!ready.ready) return { error: ready.reason }

  const health = await checkVideoPlayable(publicUrl!)
  if (!health.ok) {
    return { error: `El video no se puede reproducir desde su URL pública: ${health.reason}` }
  }

  const platforms = resolvePlatforms(client.platforms, client.default_platforms)
  const collabs = resolveEditorUploadCollaborators({
    clientId,
    includeCollabs: input.includeCollabs,
    extraUsernames: input.extraCollabUsernames,
  })

  try {
    const res = await createDraftPost(caption, blogId!, platforms, undefined, undefined, {
      mediaUrls: [publicUrl!],
      // autoPublish omitted → Metricool draft:true. Never live from this screen.
      contentType: (idea.content_type as string | null) ?? 'R',
      ...(collabs.length > 0 ? { instagramCollaborators: collabs } : {}),
    })
    const postId = res.data?.id ?? null
    const uuid = res.data?.uuid ?? null
    if (postId == null && !uuid) return { error: 'Metricool no devolvió un identificador de la publicación' }

    const { error: updErr } = await supabase
      .from('content_ideas')
      .update({
        generated_caption: caption,
        caption_draft: caption,
        metricool_post_id: postId,
        metricool_uuid: uuid,
        posting_error: null,
      })
      .eq('id', ideaId)
    if (updErr) {
      return {
        error: `Metricool creó el borrador ${postId ?? uuid}, pero no se pudo guardar en el dashboard. Verifícalo en Metricool antes de volver a enviar.`,
        metricoolPostId: postId,
      }
    }

    const userId = await getEffectiveUserId()
    await logIdeaActivity(supabase, {
      ideaId,
      userId,
      action: 'posted_to_metricool',
      metadata: {
        platforms,
        autoPublish: false,
        draft: true,
        metricoolPostId: postId,
        videoId: pinned.videoId,
        collabs: collabs.map((c) => c.username),
        source: 'editor-upload-studio',
      },
    })

    revalidatePath('/subir-video')
    revalidatePath('/pipeline')
    revalidatePath('/revision')
    return { ok: true, metricoolPostId: postId }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error al crear el borrador en Metricool' }
  }
}
