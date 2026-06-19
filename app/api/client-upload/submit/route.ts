import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateClientUpload, buildIdeaInsert } from '@/lib/utils/client-upload-core'

// Service role: create the pipeline records for an anon client submission.
function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export async function POST(req: NextRequest) {
  let body: {
    clientId?: string
    key?: string
    name?: string
    sizeBytes?: number
    mimeType?: string
    format?: string
    theme?: string
    brief?: string
    desiredDate?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  if (!body.clientId || !body.key) {
    return NextResponse.json({ error: 'Faltan datos de la subida' }, { status: 400 })
  }

  // The key must be one we just minted for THIS client (presign scopes every
  // object under client-uploads/<clientId>/…). Rejects a spoofed/foreign key.
  if (!body.key.startsWith(`client-uploads/${body.clientId}/`)) {
    return NextResponse.json({ error: 'Archivo inválido' }, { status: 400 })
  }

  const form = {
    format: body.format ?? '',
    theme: body.theme ?? '',
    brief: body.brief ?? '',
    desiredDate: body.desiredDate ?? '',
  }
  const valid = validateClientUpload(form)
  if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 })

  const sb = admin()
  const { data: client } = await sb.from('clients').select('id').eq('id', body.clientId).maybeSingle()
  if (!client) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  // 1) Create the idea so it lands on the team's pipeline board.
  const { data: idea, error: ideaErr } = await sb
    .from('content_ideas')
    .insert(buildIdeaInsert(body.clientId, form))
    .select('id')
    .single()
  if (ideaErr || !idea) {
    return NextResponse.json({ error: ideaErr?.message ?? 'No se pudo crear la idea' }, { status: 500 })
  }

  // 2) Attach the raw footage the client just uploaded to R2.
  const { error: vidErr } = await sb.from('content_idea_videos').insert({
    idea_id: idea.id,
    kind: 'raw',
    name: body.name ?? 'video',
    drive_file_id: body.key, // R2 object key
    storage_provider: 'r2',
    size_bytes: body.sizeBytes ?? null,
    mime_type: body.mimeType ?? null,
    uploaded_by: null, // anon client, no team profile
    status: 'uploaded',
  })
  if (vidErr) {
    return NextResponse.json({ error: vidErr.message }, { status: 500 })
  }

  // 3) Best-effort: advance the card to "grabada" since footage now exists.
  await sb
    .from('content_ideas')
    .update({ status: 'grabada' })
    .eq('id', idea.id)
    .in('status', ['idea', 'asignada'])

  return NextResponse.json({ ok: true, ideaId: idea.id })
}
