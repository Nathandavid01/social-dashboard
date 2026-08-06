/**
 * Los pasos del análisis de Filtro I y cómo se decide cuál toca.
 *
 * Puro: el orquestador hace las llamadas, esto solo decide. Así el reanudado
 * se puede probar sin base de datos ni APIs de pago.
 */

export type PasoFiltroI = 'transcribir' | 'analizar' | 'redactar'

export type EstadoFiltroI =
  | 'pendiente'
  | 'transcribiendo'
  | 'analizando'
  | 'redactando'
  | 'listo'
  | 'error'

/** El estado que se enseña mientras cada paso corre. */
export const ESTADO_POR_PASO: Record<PasoFiltroI, EstadoFiltroI> = {
  transcribir: 'transcribiendo',
  analizar: 'analizando',
  redactar: 'redactando',
}

/** Lo mínimo de la fila que hace falta para decidir. */
export interface EstadoAnalisis {
  transcripcion?: unknown
  errores?: unknown
  caption_base?: string | null
  caption_final?: string | null
}

const hecho = (v: unknown) => v !== null && v !== undefined
const conTexto = (s?: string | null) => !!s && s.trim().length > 0

/**
 * El siguiente paso pendiente, o null si ya está todo.
 *
 * Se mira lo GUARDADO, nunca el `status`: un proceso que muere a mitad de la
 * llamada de visión deja el status en 'analizando', y fiarse de él dejaría el
 * análisis colgado ahí para siempre. Mirando los datos, el reintento sabe que
 * la transcripción ya está y no la vuelve a pagar.
 */
export function siguientePaso(fila: EstadoAnalisis): PasoFiltroI | null {
  if (!hecho(fila.transcripcion)) return 'transcribir'
  // Vale cualquiera de las dos salidas de la visión: Grok puede dar tabla sin
  // caption (video sin mensaje claro) o al revés. Exigir las dos mandaría a
  // repetir la llamada más cara sin arreglar nada.
  if (!hecho(fila.errores) && !conTexto(fila.caption_base)) return 'analizar'
  if (!conTexto(fila.caption_final)) return 'redactar'
  return null
}
