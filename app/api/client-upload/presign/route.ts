import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { r2Client, r2Bucket, isR2Configured } from '@/lib/integrations/r2'

// Service role: anon clients upload via their magic link, no team auth. We still
// validate the client id exists before minting an upload URL.
function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export async function POST(req: NextRequest) {
  let body: { clientId?: string; fileName?: string; contentType?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }
  const { clientId, fileName, contentType } = body
  if (!clientId || !fileName) {
    return NextResponse.json({ error: 'Faltan datos del archivo' }, { status: 400 })
  }

  const sb = admin()
  const { data: client } = await sb.from('clients').select('id').eq('id', clientId).maybeSingle()
  if (!client) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const r2 = r2Client()
  if (!r2 || !isR2Configured()) {
    return NextResponse.json({ error: 'Almacenamiento no configurado' }, { status: 500 })
  }

  const key = `client-uploads/${clientId}/${Date.now()}-${slugify(fileName)}`
  try {
    const url = await getSignedUrl(
      r2,
      new PutObjectCommand({ Bucket: r2Bucket(), Key: key, ContentType: contentType || 'video/mp4' }),
      { expiresIn: 60 * 60 },
    )
    return NextResponse.json({ url, key })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'No se pudo generar la URL de subida' },
      { status: 500 },
    )
  }
}
