import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { EstadoFiltroI } from './pasos'
import type { ErrorDetectado } from '@/lib/llm/grok-vision-core'

/**
 * Las lecturas de Filtro I y Grok-ing.
 *
 * Las dos degradan a lista vacía si la tabla `filtro_i_analisis` todavía no
 * está aplicada en Supabase: la migración la aplica Nathan a mano, y hasta
 * entonces entregar videos tiene que seguir funcionando en vez de reventar la
 * página entera.
 *
 * Que el SELECT de Filtro I no pida `caption_*` no es un descuido: es dónde se
 * hace cumplir que el editor no ve el caption. Si no se trae, no puede
 * enseñarse por accidente.
 */

interface FilaCruda {
  id: string
  video_id: string
  status: EstadoFiltroI
  errores: ErrorDetectado[] | null
  error_paso: string | null
  error_mensaje: string | null
  caption_base?: string | null
  caption_final?: string | null
  idea?: { id: string; title: string | null; client_id: string | null; client?: { name: string | null } | null } | null
}

export interface AnalisisFiltroI {
  id: string
  videoId: string
  titulo: string
  clientName: string
  clientId: string | null
  status: EstadoFiltroI
  errores: ErrorDetectado[]
  /** Dónde se paró. Con status distinto de 'error' es un aviso, no un fallo. */
  errorPaso: string | null
  errorMensaje: string | null
}

export interface AnalisisGrokIng extends AnalisisFiltroI {
  captionBase: string | null
  captionFinal: string | null
}

const IDEA = 'idea:content_ideas(id, title, client_id, client:clients(name))'

function mapear(f: FilaCruda): AnalisisFiltroI {
  return {
    id: f.id,
    videoId: f.video_id,
    titulo: f.idea?.title?.trim() || 'Sin título',
    clientName: f.idea?.client?.name ?? 'Sin cliente',
    clientId: f.idea?.client_id ?? null,
    status: f.status,
    errores: f.errores ?? [],
    errorPaso: f.error_paso,
    errorMensaje: f.error_mensaje,
  }
}

/** Para la pantalla del editor. Sin caption, a propósito. */
export async function cargarAnalisisFiltroI(
  supabase: SupabaseClient,
  opts: { limit?: number } = {},
): Promise<AnalisisFiltroI[]> {
  const { data, error } = await supabase
    .from('filtro_i_analisis')
    .select(`id, video_id, status, errores, error_paso, error_mensaje, ${IDEA}`)
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 50)

  if (error || !data) return []
  return (data as unknown as FilaCruda[]).map(mapear)
}

/** Para Grok-ing. Aquí sí viaja el caption. */
export async function cargarAnalisisGrokIng(
  supabase: SupabaseClient,
  opts: { limit?: number } = {},
): Promise<AnalisisGrokIng[]> {
  const { data, error } = await supabase
    .from('filtro_i_analisis')
    .select(`id, video_id, status, errores, error_paso, error_mensaje, caption_base, caption_final, ${IDEA}`)
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 50)

  if (error || !data) return []
  return (data as unknown as FilaCruda[]).map((f) => ({
    ...mapear(f),
    captionBase: f.caption_base ?? null,
    captionFinal: f.caption_final ?? null,
  }))
}
