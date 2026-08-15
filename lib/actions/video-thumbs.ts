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
import { requirePermission, currentUserHas } from '@/lib/auth/server'
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

const MAX_THUMB_COUNT = 8

/** Nunca confiar en el count del caller: 1..8, sin importar lo que llegue. */
function clampCount(count: number): number {
  if (!Number.isFinite(count)) return 1
  return Math.max(1, Math.min(MAX_THUMB_COUNT, Math.floor(count)))
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
  const n = clampCount(count)

  try {
    const keys = Array.from({ length: n }, (_, i) => `${folder}/thumbs/${ts}-${i}.jpg`)
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
  const { data: video, error: fetchError } = await supabase
    .from('content_idea_videos')
    .select('drive_file_id')
    .eq('id', videoId)
    .single()
  if (fetchError || !video?.drive_file_id) return { error: 'Video no encontrado' }

  // Un video.upload no debe poder registrar keys de OTRO video/carpeta —
  // eso permitiría luego presign-GET de material ajeno vía getVideoThumbViewUrls.
  const allowedPrefix = `${dirnameOf(video.drive_file_id as string)}/thumbs/`
  if (!keys.every((k) => k.startsWith(allowedPrefix))) {
    return { error: 'Keys de thumbnail inválidas para este video' }
  }

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
  // Mismo gating que getEntregasPreviewUrl: pipeline, /revision y /entregas
  // comparten esta lectura, así que cualquiera de esos permisos basta.
  const canView =
    (await currentUserHas('revision.read')) ||
    (await currentUserHas('entregas.read')) ||
    (await currentUserHas('planning.read'))
  if (!canView) return { urls: [] }

  const supabase = await createClient()
  const { data: video, error } = await supabase
    .from('content_idea_videos')
    .select('thumb_keys, storage_provider, status')
    .eq('id', videoId)
    .single()
  // Sin fila, error de query (p.ej. columna no existe aún) → fallback silencioso.
  if (error || !video) return { urls: [] }
  if (video.status === 'archived' || video.status === 'failed') return { urls: [] }

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
