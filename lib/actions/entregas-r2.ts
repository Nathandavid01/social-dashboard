'use server'

import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createClient } from '@/lib/supabase/server'
import { requirePermission, currentUserHas } from '@/lib/auth/server'
import {
  entregasR2Client,
  entregasR2Bucket,
  isEntregasR2Configured,
  ENTREGAS_PROVIDER,
} from '@/lib/integrations/entregas-r2'

/**
 * Upload/playback for Entregas, against its own bucket.
 *
 * Rows land in the shared content_idea_videos with storage_provider
 * 'entregas-r2' so publishing knows which bucket to build the public URL from —
 * tagging them 'r2' like the other board did is how a video ends up looked for
 * in a bucket it was never in.
 */

function slugify(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9.]+/g, '-').toLowerCase()
}

export async function getEntregasUploadUrl(input: {
  ideaId: string
  fileName: string
  contentType: string
}): Promise<{ url?: string; key?: string; error?: string }> {
  try {
    await requirePermission('video.upload')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const client = entregasR2Client()
  if (!client || !isEntregasR2Configured()) {
    return { error: 'R2 de Entregas no está configurado (faltan ENTREGAS_R2_*)' }
  }

  // El segmento /edited/ importa: es lo que un Worker público puede filtrar
  // para no exponer material crudo.
  const key = `entregas/${input.ideaId}/edited/${Date.now()}-${slugify(input.fileName)}`
  try {
    const url = await getSignedUrl(
      client,
      new PutObjectCommand({ Bucket: entregasR2Bucket(), Key: key, ContentType: input.contentType }),
      { expiresIn: 60 * 60 },
    )
    return { url, key }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error generando URL de subida' }
  }
}

export async function registerEntregasVideo(input: {
  ideaId: string
  key: string
  name: string
  sizeBytes: number
  mimeType: string
}): Promise<{ ok?: true; id?: string; error?: string }> {
  try {
    await requirePermission('video.upload')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('content_idea_videos')
    .insert({
      idea_id: input.ideaId,
      kind: 'edited',
      name: input.name,
      drive_file_id: input.key,
      storage_provider: ENTREGAS_PROVIDER,
      size_bytes: input.sizeBytes,
      mime_type: input.mimeType,
      uploaded_by: user?.id ?? null,
      status: 'uploaded',
    })
    .select('id')
    .single()
  if (error) return { error: error.message }
  return { ok: true, id: data.id }
}

/** Presigned GET for inline playback — usable straight as a <video src>. */
export async function getEntregasPreviewUrl(
  videoId: string,
): Promise<{ url?: string; error?: string }> {
  // Cualquiera de las dos pantallas del flujo: el editor vive en /revision y
  // el copy en /entregas, pero ambos necesitan mirar el mismo video.
  if (!(await currentUserHas('revision.read')) && !(await currentUserHas('entregas.read'))) {
    return { error: 'No autorizado' }
  }

  const supabase = await createClient()
  const { data: video, error } = await supabase
    .from('content_idea_videos')
    .select('drive_file_id, storage_provider')
    .eq('id', videoId)
    .single()
  if (error || !video?.drive_file_id) return { error: 'Video no encontrado' }

  const client = entregasR2Client()
  if (!client) return { error: 'R2 de Entregas no está configurado' }

  try {
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: entregasR2Bucket(),
        Key: video.drive_file_id,
        ResponseContentDisposition: 'inline',
      }),
      { expiresIn: 60 * 60 },
    )
    return { url }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error generando URL de preview' }
  }
}
