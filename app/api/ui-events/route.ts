import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseUiEventBatch } from '@/lib/utils/ui-events-core'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const parsed = parseUiEventBatch(body)
  if (parsed.error) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  if (parsed.events.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0 })
  }

  const rows = parsed.events.map((e) => ({
    user_id: user.id,
    kind: e.kind,
    path: e.path,
    label: e.label,
    target: e.target,
  }))

  const { error } = await supabase.from('ui_events').insert(rows)
  if (error) {
    console.warn('[ui-events] insert failed:', error.message)
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, inserted: rows.length })
}
