'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission, currentUserHas } from '@/lib/auth/server'
import { claveFrame, firmarPutFrame, firmarGet } from '@/lib/filtro-i/r2-urls'

/**
 * Server actions de Filtro I.
 *
 * Archivo propio en vez de tocar `lib/actions/entregas-r2.ts`: aquel gatea por
 * `revision.read`/`entregas.read` y Filtro I tiene su propio permiso. Comparten
 * bucket, no código.
 */

const TABLA = 'filtro_i_analisis'

/**
 * Prepara el análisis de un video recién subido: crea (o reinicia) la fila y
 * devuelve las URLs firmadas para que el navegador suba los frames que acaba de
 * sacar del <canvas>.
 *
 * Reanalizar sobrescribe la fila anterior en vez de acumular: la pantalla no
 * tendría forma de decidir cuál de dos análisis del mismo video enseñar.
 */
export async function prepararAnalisis(input: {
  ideaId: string
  videoId: string
  momentos: number[]
}): Promise<{ analisisId?: string; urls?: string[]; error?: string }> {
  try {
    await requirePermission('filtro_i.read')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  if (!input.momentos.length) {
    return { error: 'No se pudo leer la duración del video para sacar los frames.' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from(TABLA)
    .upsert(
      {
        idea_id: input.ideaId,
        video_id: input.videoId,
        status: 'pendiente',
        frame_momentos: input.momentos,
        frames_count: input.momentos.length,
        // Un reanálisis empieza de cero: si no, `siguientePaso` vería la
        // transcripción vieja y se saltaría el video nuevo.
        transcripcion: null,
        errores: null,
        caption_base: null,
        caption_final: null,
        error_paso: null,
        error_mensaje: null,
      },
      { onConflict: 'video_id' },
    )
    .select('id')
    .single()

  if (error || !data) return { error: error?.message ?? 'No se pudo crear el análisis' }

  const urls: string[] = []
  for (let i = 0; i < input.momentos.length; i++) {
    const url = await firmarPutFrame(claveFrame(input.ideaId, input.videoId, i))
    if (!url) return { error: 'R2 de Entregas no está configurado (faltan ENTREGAS_R2_*)' }
    urls.push(url)
  }

  return { analisisId: data.id, urls }
}

/** GET firmado del video para reproducirlo en la tarjeta. */
export async function getFiltroIPreviewUrl(
  videoId: string,
): Promise<{ url?: string; error?: string }> {
  // Las dos pantallas que enseñan el video de este flujo. Grok-ing entra
  // porque enseña el caption junto al video del que salió.
  if (!(await currentUserHas('filtro_i.read')) && !(await currentUserHas('grok_ing.read'))) {
    return { error: 'No autorizado' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('content_idea_videos')
    .select('drive_file_id')
    .eq('id', videoId)
    .single()

  if (error || !data?.drive_file_id) return { error: 'Video no encontrado' }

  const url = await firmarGet(data.drive_file_id)
  return url ? { url } : { error: 'No se pudo firmar la URL del video' }
}
