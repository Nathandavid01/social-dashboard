import { GetObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@/lib/supabase/server'
import { currentUserHas } from '@/lib/auth/server'
import { r2Client, r2Bucket } from '@/lib/integrations/r2'
import { entregasR2Client, entregasR2Bucket } from '@/lib/integrations/entregas-r2'
import { safeServeContentType } from '@/lib/utils/video-upload-guard'

export const dynamic = 'force-dynamic'

/**
 * Sirve el video por el MISMO ORIGEN, no una URL firmada de R2. Ni el bucket
 * privado (presigned GET) ni el dominio público r2.dev mandan
 * `access-control-allow-origin` — verificado con peticiones reales (Origin
 * header, ambas 206 sin ACAO). Sin CORS, `<video crossOrigin="anonymous">`
 * no carga, y sin `crossOrigin` el canvas queda "tainted" y
 * `toDataURL()` lanza `SecurityError`. Por eso la tira de escenas (solo
 * `drawImage`, nunca lee píxeles) funciona hoy pero la extracción de
 * fotogramas para QC IA (`analyzeExistingVideo`) NUNCA podría funcionar
 * leyendo directo de R2 desde el browser. Mismo-origen resuelve ambos
 * problemas sin tocar CORS del lado de R2.
 *
 * Mismo gate de lectura que `getVideoPreviewUrl`/`getEntregasPreviewUrl` — un
 * id no es suficiente para leer el video, hace falta al menos uno de estos.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> },
): Promise<Response> {
  const { videoId } = await params

  const allowed =
    (await currentUserHas('revision.read')) ||
    (await currentUserHas('entregas.read')) ||
    (await currentUserHas('planning.read'))
  if (!allowed) return new Response('No autorizado', { status: 403 })

  const supabase = await createClient()
  const { data: video, error } = await supabase
    .from('content_idea_videos')
    .select('drive_file_id, storage_provider, status')
    .eq('id', videoId)
    .maybeSingle()

  if (error || !video || !video.drive_file_id) return new Response('Video no encontrado', { status: 404 })
  if (video.status === 'archived' || video.status === 'failed') {
    return new Response('Este video no está disponible', { status: 404 })
  }

  const provider = video.storage_provider as string
  const client = provider === 'r2' ? r2Client() : provider === 'entregas-r2' ? entregasR2Client() : null
  const bucket = provider === 'r2' ? r2Bucket() : provider === 'entregas-r2' ? entregasR2Bucket() : ''
  if (!client) return new Response('Storage no soportado', { status: 404 })

  // El <video> del browser pide rangos (para poder hacer seek sin bajar todo
  // el archivo) — reenviamos la misma cabecera Range que recibimos.
  const range = request.headers.get('range') ?? undefined

  try {
    const obj = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: video.drive_file_id, Range: range }),
    )
    const body = obj.Body as { transformToWebStream?: () => ReadableStream } | undefined
    if (!body?.transformToWebStream) return new Response('Video no encontrado', { status: 404 })

    // Nunca confiar en el Content-Type guardado (audit finding: se podía
    // subir un .html y este proxy lo servía tal cual, ejecutable en el
    // dominio del dashboard). Si no es un video/* conocido, degrada a
    // application/octet-stream + descarga forzada — el navegador nunca lo
    // renderiza inline ni lo "adivina" (nosniff).
    const contentType = safeServeContentType(obj.ContentType)
    const headers = new Headers({
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'X-Content-Type-Options': 'nosniff',
      // Nunca público: gateado por permiso, no queremos que un CDN/proxy lo
      // cachee para cualquiera.
      'Cache-Control': 'private, no-store',
    })
    if (contentType === 'application/octet-stream') {
      headers.set('Content-Disposition', 'attachment')
    }
    if (obj.ContentLength != null) headers.set('Content-Length', String(obj.ContentLength))
    if (obj.ContentRange) headers.set('Content-Range', obj.ContentRange)

    // Streaming, no bufferiza el video entero en memoria del servidor.
    return new Response(body.transformToWebStream(), {
      status: obj.ContentRange ? 206 : 200,
      headers,
    })
  } catch {
    return new Response('Error leyendo el video', { status: 502 })
  }
}
