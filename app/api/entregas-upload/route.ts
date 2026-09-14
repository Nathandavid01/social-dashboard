import { PutObjectCommand } from '@aws-sdk/client-s3'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/server'
import {
  entregasR2Client,
  entregasR2Bucket,
  isEntregasR2Configured,
} from '@/lib/integrations/entregas-r2'
import {
  assertEntregasDirectUpload,
  buildEntregasEditedKey,
  entregasDirectContentType,
} from '@/lib/utils/entregas-direct-upload'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * PUT same-origin → PutObject en R2 de Entregas.
 * El presign al bucket no manda ACAO (ver /api/video-file): el browser
 * reporta xhr.onerror sin status. Este camino evita CORS.
 */
export async function PUT(req: Request): Promise<Response> {
  try {
    await requirePermission('video.upload')
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'No autorizado' },
      { status: 403 },
    )
  }

  const url = new URL(req.url)
  const ideaId = url.searchParams.get('ideaId')
  const fileName = url.searchParams.get('fileName')
  const rawType = req.headers.get('content-type')
  const contentType = entregasDirectContentType(fileName ?? '', rawType)
  const lengthHeader = req.headers.get('content-length')
  const contentLength = lengthHeader != null ? Number(lengthHeader) : null

  const gate = assertEntregasDirectUpload({
    ideaId,
    fileName,
    contentType,
    contentLength,
  })
  if (gate) return NextResponse.json({ error: gate }, { status: 400 })

  if (!isEntregasR2Configured()) {
    return NextResponse.json(
      { error: 'R2 de Entregas no está configurado (faltan ENTREGAS_R2_*)' },
      { status: 503 },
    )
  }
  const client = entregasR2Client()
  if (!client) {
    return NextResponse.json({ error: 'R2 de Entregas no está configurado' }, { status: 503 })
  }

  const key = buildEntregasEditedKey(ideaId!, fileName!)
  if (!key) return NextResponse.json({ error: 'Falta la idea' }, { status: 400 })

  const body = Buffer.from(await req.arrayBuffer())
  if (body.byteLength < 1) {
    return NextResponse.json({ error: 'Falta el archivo de video.' }, { status: 400 })
  }

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: entregasR2Bucket(),
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    )
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'No se pudo guardar el video' },
      { status: 502 },
    )
  }

  return NextResponse.json({ key, contentType })
}
