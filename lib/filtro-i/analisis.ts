import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { transcribirDesdeUrl } from '@/lib/integrations/whisperapi'
import { analizarFrames } from '@/lib/llm/grok-vision'
import { buildFiltroIPrompt } from './prompt'
import { claveFrame, firmarGet } from './r2-urls'
import { generarCaptionFinal } from './caption'
import { siguientePaso, ESTADO_POR_PASO, type EstadoFiltroI, type PasoFiltroI } from './pasos'
import type { SegmentoTranscripcion } from '@/lib/integrations/whisperapi-core'

/**
 * El orquestador de Filtro I: transcribir → analizar → redactar.
 *
 * Un paso a la vez, persistiendo después de cada uno. Un fallo en la visión no
 * tira la transcripción ya pagada: el reintento mira lo guardado (ver
 * `siguientePaso`) y sigue donde se quedó.
 *
 * El video nunca se descarga aquí. WhisperAPI y xAI reciben URLs prefirmadas de
 * R2 y bajan lo suyo por su cuenta — es lo que mantiene la función lejos de su
 * límite de tiempo y de memoria.
 */

const TABLA = 'filtro_i_analisis'

interface FilaAnalisis {
  id: string
  idea_id: string
  video_id: string
  status: EstadoFiltroI
  frame_momentos: number[] | null
  frames_count: number
  transcripcion: SegmentoTranscripcion[] | null
  errores: unknown[] | null
  caption_base: string | null
  caption_final: string | null
}

export interface ResultadoProceso {
  status: EstadoFiltroI
  error?: string
}

async function claveDelVideo(
  supabase: SupabaseClient,
  videoId: string,
): Promise<string> {
  const { data } = await supabase
    .from('content_idea_videos')
    .select('drive_file_id')
    .eq('id', videoId)
    .single()
  const key = data?.drive_file_id
  if (!key) throw new Error('El video no tiene archivo en R2')
  return key
}

async function urlFirmadaObligatoria(key: string, queEs: string): Promise<string> {
  const url = await firmarGet(key)
  if (!url) throw new Error(`No se pudo firmar la URL ${queEs} (¿faltan ENTREGAS_R2_*?)`)
  return url
}

/** Lo que un paso deja guardado, más un aviso no fatal si lo hubo. */
interface ResultadoPaso {
  cambios: Record<string, unknown>
  /** Salió adelante, pero degradado. No corta el análisis. */
  aviso?: string
}

/** Un paso. Devuelve lo que hay que guardar en la fila. */
async function ejecutarPaso(
  paso: PasoFiltroI,
  fila: FilaAnalisis,
  supabase: SupabaseClient,
): Promise<ResultadoPaso> {
  if (paso === 'transcribir') {
    const key = await claveDelVideo(supabase, fila.video_id)
    const url = await urlFirmadaObligatoria(key, 'del video')
    try {
      const { segmentos } = await transcribirDesdeUrl(url)
      // Un video mudo da []. Es un resultado, no un hueco: guardarlo es lo que
      // evita que el reintento vuelva a transcribir para siempre.
      return { cambios: { transcripcion: segmentos } }
    } catch (err) {
      // NO se propaga. Sin audio se pierde la comparación audio↔subtítulo,
      // pero Grok sigue pudiendo revisar ortografía, tildes y puntuación de lo
      // que ve en pantalla. Tirar el análisis entero dejaría al editor sin la
      // revisión que sí se podía hacer — y un video mudo caería igual aquí.
      //
      // El aviso viaja en error_paso/error_mensaje y la pantalla lo enseña
      // (ver `sinAudio`): una tabla hecha sin oír el video parece completa y no
      // lo es, así que callarlo sería peor que no analizarlo.
      return {
        cambios: { transcripcion: [] },
        aviso: err instanceof Error ? err.message : 'No se pudo transcribir el audio',
      }
    }
  }

  if (paso === 'analizar') {
    const momentos = fila.frame_momentos ?? []
    // Los frames viven en R2; xAI los lee por URL firmada, así que no hay que
    // pasarlos a base64 ni cargarlos en memoria.
    const urls: string[] = []
    for (let i = 0; i < (fila.frames_count || momentos.length); i++) {
      const url = await firmarGet(claveFrame(fila.idea_id, fila.video_id, i))
      if (url) urls.push(url)
    }
    if (!urls.length) throw new Error('No hay frames subidos para analizar')

    const { errores, captionBase, modelo } = await analizarFrames({
      prompt: buildFiltroIPrompt({ segmentos: fila.transcripcion ?? [], momentos }),
      imagenes: urls,
    })
    return { cambios: { errores, caption_base: captionBase, modelo_vision: modelo } }
  }

  // redactar
  const caption = await generarCaptionFinal({
    supabase,
    ideaId: fila.idea_id,
    captionBase: fila.caption_base ?? '',
  })
  return { cambios: { caption_final: caption } }
}

/**
 * Lleva un análisis hasta el final (o hasta el primer fallo).
 *
 * Todos los pasos caben de sobra en una invocación: la suma ronda los 40–105s
 * y el techo del plan es 300s. El troceado no es por tiempo, es para que un
 * reintento no repita lo ya pagado.
 */
export async function procesarAnalisis(
  supabase: SupabaseClient,
  analisisId: string,
): Promise<ResultadoProceso> {
  for (;;) {
    const { data, error } = await supabase
      .from(TABLA)
      .select('id, idea_id, video_id, status, frame_momentos, frames_count, transcripcion, errores, caption_base, caption_final')
      .eq('id', analisisId)
      .single()

    if (error || !data) return { status: 'error', error: 'Análisis no encontrado' }
    const fila = data as FilaAnalisis

    const paso = siguientePaso(fila)
    if (!paso) {
      // Sin limpiar error_paso/error_mensaje: un fallo FATAL ya habría salido
      // por el `return` de abajo, así que lo que quede aquí es un aviso no
      // fatal (hoy solo el de "sin audio") y la pantalla lo necesita.
      await supabase.from(TABLA).update({ status: 'listo' }).eq('id', analisisId)
      return { status: 'listo' }
    }

    await supabase.from(TABLA).update({ status: ESTADO_POR_PASO[paso] }).eq('id', analisisId)

    try {
      const { cambios, aviso } = await ejecutarPaso(paso, fila, supabase)
      // El aviso se escribe solo en el primer paso, que es el único que hoy
      // puede degradar. Así un reintento parte de limpio y los pasos de después
      // no pisan lo que dejó este.
      const marca =
        paso === 'transcribir'
          ? { error_paso: aviso ? 'transcribir' : null, error_mensaje: aviso ?? null }
          : {}
      await supabase.from(TABLA).update({ ...cambios, ...marca }).eq('id', analisisId)
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'Error desconocido'
      await supabase
        .from(TABLA)
        .update({ status: 'error', error_paso: paso, error_mensaje: mensaje.slice(0, 500) })
        .eq('id', analisisId)
      return { status: 'error', error: mensaje }
    }
  }
}
