'use server'

/**
 * Tira de 5 escenas — subir/registrar/leer thumbnails del video editado.
 *
 * Presigna PUTs/GETs contra EL MISMO bucket del video (r2 vs entregas-r2),
 * igual que hace getVideoPreviewUrl con la lectura del video mismo. Nada
 * aquí rompe la subida ni el panel: cualquier fallo devuelve {error} (o
 * { urls: [] } en lectura) en vez de lanzar — incluida la ausencia de la
 * columna `thumb_keys` antes de aplicar la migración 0062.
 */

import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { r2Client, r2Bucket, isR2Configured } from '@/lib/integrations/r2'
import { entregasR2Client, entregasR2Bucket, isEntregasR2Configured } from '@/lib/integrations/entregas-r2'

type BucketHandle = { client: ReturnType<typeof r2Client>; bucket: string }

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

/** Carpeta del video (todo antes del último segmento de la key). */
function dirnameOf(key: string): string {
  const i = key.lastIndexOf('/')
  return i === -1 ? '' : key.slice(0, i)
}

export async function getThumbUploadUrls(
  videoId: string,
  count: number,
): Promise<{ urls?: string[]; keys?: string[]; error?: string }> {
  try {
    await requirePermission('video.upload')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()
  const { data: video, error } = await supabase
    .from('content_idea_videos')
    .select('drive_file_id, storage_provider')
    .eq('id', videoId)
    .single()
  if (error || !video?.drive_file_id) return { error: 'Video no encontrado' }

  const handle = bucketFor(video.storage_provider as string)
  if (!handle) return { error: `Proveedor de storage no soportado para thumbnails: ${video.storage_provider}` }

  const folder = dirnameOf(video.drive_file_id as string)
  const ts = Date.now()

  try {
    const keys = Array.from({ length: count }, (_, i) => `${folder}/thumbs/${ts}-${i}.jpg`)
    const urls = await Promise.all(
      keys.map((key) =>
        getSignedUrl(
          handle.client!,
          new PutObjectCommand({ Bucket: handle.bucket, Key: key, ContentType: 'image/jpeg' }),
          { expiresIn: 60 * 60 },
        ),
      ),
    )
    return { urls, keys }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error generando URLs de subida de thumbnails' }
  }
}

export async function registerVideoThumbs(
  videoId: string,
  keys: string[],
): Promise<{ ok?: true; error?: string }> {
  try {
    await requirePermission('video.upload')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('content_idea_videos')
    .update({ thumb_keys: keys })
    .eq('id', videoId)
  // Best-effort: si la columna aún no existe (migración 0062 sin aplicar),
  // devolvemos el error sin lanzar — la subida ya terminó, esto es solo la tira.
  if (error) return { error: error.message }
  return { ok: true }
}

export async function getVideoThumbViewUrls(videoId: string): Promise<{ urls: string[] }> {
  const supabase = await createClient()
  const { data: video, error } = await supabase
    .from('content_idea_videos')
    .select('thumb_keys, storage_provider')
    .eq('id', videoId)
    .single()
  // Sin fila, error de query (p.ej. columna no existe aún) → fallback silencioso.
  if (error || !video) return { urls: [] }

  const keys = (video.thumb_keys as string[] | null) ?? []
  if (keys.length === 0) return { urls: [] }

  const handle = bucketFor(video.storage_provider as string)
  if (!handle) return { urls: [] }

  try {
    const urls = await Promise.all(
      keys.map((key) =>
        getSignedUrl(
          handle.client!,
          new GetObjectCommand({ Bucket: handle.bucket, Key: key, ResponseContentDisposition: 'inline' }),
          { expiresIn: 60 * 60 },
        ),
      ),
    )
    return { urls }
  } catch {
    return { urls: [] }
  }
}
