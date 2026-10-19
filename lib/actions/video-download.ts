'use server'

/**
 * Unified signed download — routes by storage_provider so pipeline R2 (`r2`)
 * and Entregas R2 (`entregas-r2`) both download. Recibo previously called
 * getR2DownloadUrl for pipeline cuts, which re-applied the editor-bank
 * assignment gate and blocked copy/unassigned staff (Denisha / Yabushi).
 */

import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createClient } from '@/lib/supabase/server'
import { currentUserHas, getEffectiveRole, getEffectiveUserId } from '@/lib/auth/server'
import { canDownloadIdeaVideo } from '@/lib/pipeline/editor-video-bank'
import { r2Client, r2Bucket, isR2Configured } from '@/lib/integrations/r2'
import { entregasR2Client, entregasR2Bucket, isEntregasR2Configured } from '@/lib/integrations/entregas-r2'
import { attachmentDisposition } from '@/lib/utils/content-disposition'

const VIDEO_DOWNLOAD_SELECT = `
  id, kind, status, drive_file_id, storage_provider, name, uploaded_by,
  idea:content_ideas!content_idea_videos_idea_id_fkey(
    id,
    production_task:production_tasks!content_ideas_production_task_id_fkey(assigned_to_id),
    client:clients!content_ideas_client_id_fkey(assigned_to)
  )
`

async function canReadEditedDashboard(): Promise<boolean> {
  return (
    (await currentUserHas('revision.read')) ||
    (await currentUserHas('entregas.read')) ||
    (await currentUserHas('planning.read')) ||
    (await currentUserHas('video_stock.read'))
  )
}

export async function getVideoDownloadUrl(
  videoId: string,
): Promise<{ url?: string; provider?: string; error?: string }> {
  if (!videoId) return { error: 'Video no encontrado' }

  const supabase = await createClient()
  const { data: video, error } = await supabase
    .from('content_idea_videos')
    .select(VIDEO_DOWNLOAD_SELECT)
    .eq('id', videoId)
    .maybeSingle()

  if (error || !video) return { error: 'Video no encontrado' }
  if (video.status === 'archived' || video.status === 'failed') {
    return { error: 'Este video no está disponible para descargar' }
  }

  const { data: { user } } = await supabase.auth.getUser()
  const ownUpload = !!user && video.uploaded_by === user.id
  const idea = video.idea as {
    production_task?: { assigned_to_id?: string | null } | null
    client?: { assigned_to?: string | null } | null
  } | null
  const bankOk = canDownloadIdeaVideo({
    role: await getEffectiveRole(),
    userId: await getEffectiveUserId(),
    ideaAssigneeId: idea?.production_task?.assigned_to_id ?? null,
    clientAssigneeId: idea?.client?.assigned_to ?? null,
    uploadedBy: video.uploaded_by,
  }, video.kind as string | undefined)
  const editedOk = video.kind === 'edited' && (await canReadEditedDashboard())
  if (!ownUpload && !bankOk && !editedOk) return { error: 'No autorizado' }

  const provider = video.storage_provider as string | null
  const key = typeof video.drive_file_id === 'string' ? video.drive_file_id.trim() : ''
  if (!key) return { error: 'Este video no tiene un archivo descargable.', provider: provider ?? undefined }

  if (provider === 'drive') {
    return {
      error: 'Este video está en Google Drive. Ábrelo desde Drive; no se puede bajar desde el dashboard.',
      provider,
    }
  }

  if (provider === 'r2') {
    const client = r2Client()
    if (!client || !isR2Configured()) return { error: 'R2 no está configurado', provider }
    try {
      const url = await getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: r2Bucket(),
          Key: key,
          ResponseContentDisposition: attachmentDisposition(video.name),
        }),
        { expiresIn: 60 * 60 },
      )
      return { url, provider }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Error generando URL de descarga', provider }
    }
  }

  if (provider === 'entregas-r2') {
    const client = entregasR2Client()
    if (!client || !isEntregasR2Configured()) return { error: 'R2 de Entregas no está configurado', provider }
    try {
      const url = await getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: entregasR2Bucket(),
          Key: key,
          ResponseContentDisposition: attachmentDisposition(video.name),
        }),
        { expiresIn: 60 * 60 },
      )
      return { url, provider }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Error generando URL de descarga', provider }
    }
  }

  return { error: `Proveedor de storage no soportado: ${provider ?? 'desconocido'}`, provider: provider ?? undefined }
}
