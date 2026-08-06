import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { currentUserHas } from '@/lib/auth/server'
import { procesarAnalisis } from '@/lib/filtro-i/analisis'

/**
 * Dispara y consulta el análisis de Filtro I.
 *
 * No lo mueve un cron: en el plan Hobby los crons corren una vez al día, que no
 * sirve para algo que el editor está esperando. Lo arranca el navegador al
 * terminar de subir, y la tarjeta consulta el estado con GET.
 */

// Transcripción + visión + caption suman ~40–105s. El techo del plan es 300s.
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!(await currentUserHas('filtro_i.read'))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { analisisId } = await req.json().catch(() => ({}))
  if (!analisisId) {
    return NextResponse.json({ error: 'Falta analisisId' }, { status: 400 })
  }

  const supabase = await createClient()
  const res = await procesarAnalisis(supabase, analisisId)

  // 200 aunque el análisis falle: la petición HTTP fue bien, lo que falló es el
  // trabajo — y su detalle ya está en la fila para que la tarjeta lo enseñe.
  return NextResponse.json(res)
}

export async function GET(req: NextRequest) {
  if (!(await currentUserHas('filtro_i.read'))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const analisisId = req.nextUrl.searchParams.get('analisisId')
  if (!analisisId) {
    return NextResponse.json({ error: 'Falta analisisId' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('filtro_i_analisis')
    // El caption NO sale por aquí: este endpoint lo consulta la pantalla del
    // editor, y el editor no ve el caption. Vive en Grok-ing.
    .select('id, status, errores, error_paso, error_mensaje')
    .eq('id', analisisId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(data)
}
