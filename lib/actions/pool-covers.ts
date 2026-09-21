'use server'

/**
 * Carátulas del Panel (/pool): presign del primer thumb_key y persistencia
 * de un poster JPG en el MISMO bucket del video. posting.read para ver;
 * video.upload para guardar. Sin FK nueva entre ideas y videos.
 */

import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createClient } from '@/lib/supabase/server'
import { currentUserHas, requirePermission } from '@/lib/auth/server'
import { isR2Configured, r2Bucket, r2Client } from '@/lib/integrations/r2'
import {
  entregasR2Bucket,
  entregasR2Client,
  isEntregasR2Configured,
} from '@/lib/integrations/entregas-r2'
import { isSafePoolPosterKey, poolPosterObjectKey } from '@/lib/utils/pool-caratula'

const MAX_COVERS = 80

type BucketHandle = { client: NonNullable<ReturnType<typeof r2Client>>; bucket: string }

function bucketFor(provider: string): BucketHandle | null {
  if (provider === 'r2') {
    if (!isR2Configured()) return null
    const client = r2Client()
    return client ? { client, bucket: r2Bucket() } : null
  }
  if (provider === 'entregas-r2') {
    if (!isEntregasR2Configured()) return null
    const client = entregasR2Client()
    return client ? { client, bucket: entregasR2Bucket() } : null
  }
  return null
}

export async function getPoolCoverUrls(
  videoIds: string[],
): Promise<{ urls?: Record<string, string>; error?: string }> {
  if (!(await currentUserHas('posting.read'))) return { error: 'No autorizado' }

  const ids = Array.from(new Set(videoIds.filter(Boolean))).slice(0, MAX_COVERS)
  if (ids.length === 0) return { urls: {} }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('content_idea_videos')
    .select('id, thumb_keys, storage_provider, status')
    .in('id', ids)
  if (error) return { error: error.message }

  const urls: Record<string, string> = {}
  await Promise.all(
    (data ?? []).map(async (row) => {
      if (row.status === 'archived' || row.status === 'failed') return
      const key = ((row.thumb_keys as string[] | null) ?? []).find(Boolean)
      if (!key) return
      const handle = bucketFor(row.storage_provider as string)
      if (!handle) return
      try {
        urls[row.id as string] = await getSignedUrl(
          handle.client,
          new GetObjectCommand({
            Bucket: handle.bucket,
            Key: key,
            ResponseContentDisposition: 'inline',
          }),
          { expiresIn: 60 * 60 },
        )
      } catch {
        /* sin carátula: el tile enseña placeholder o extrae el frame */
      }
    }),
  )
  return { urls }
}

export async function getPoolPosterUploadUrl(
  videoId: string,
): Promise<{ url?: string; key?: string; error?: string }> {
  try {
    await requirePermission('video.upload')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }
  if (!videoId) return { error: 'Video no encontrado' }

  const supabase = await createClient()
  const { data: video, error } = await supabase
    .from('content_idea_videos')
    .select('drive_file_id, storage_provider, thumb_keys')
    .eq('id', videoId)
    .single()
  if (error || !video?.drive_file_id) return { error: 'Video no encontrado' }

  const handle = bucketFor(video.storage_provider as string)
  if (!handle) return { error: `Proveedor de storage no soportado: ${video.storage_provider}` }

  const key = poolPosterObjectKey(video.drive_file_id as string)
  try {
    const url = await getSignedUrl(
      handle.client,
      new PutObjectCommand({ Bucket: handle.bucket, Key: key, ContentType: 'image/jpeg' }),
      { expiresIn: 60 * 60 },
    )
    return { url, key }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error generando URL de subida' }
  }
}

export async function registerPoolPoster(
  videoId: string,
  key: string,
): Promise<{ ok?: true; error?: string }> {
  try {
    await requirePermission('video.upload')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }
  if (!videoId || !key) return { error: 'Falta el poster' }

  const supabase = await createClient()
  const { data: video, error } = await supabase
    .from('content_idea_videos')
    .select('drive_file_id, thumb_keys')
    .eq('id', videoId)
    .single()
  if (error || !video?.drive_file_id) return { error: 'Video no encontrado' }

  if (!isSafePoolPosterKey(video.drive_file_id as string, key)) {
    return { error: 'Key de poster inválida para este video' }
  }

  const existing = ((video.thumb_keys as string[] | null) ?? []).filter(Boolean)
  if (existing.length > 0) return { ok: true }

  const { error: updateError } = await supabase
    .from('content_idea_videos')
    .update({ thumb_keys: [key] })
    .eq('id', videoId)
  if (updateError) return { error: updateError.message }
  return { ok: true }
}
