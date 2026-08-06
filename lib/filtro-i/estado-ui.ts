import type { EstadoFiltroI } from './pasos'

/**
 * El estado del análisis, traducido a lo que ve el editor.
 *
 * El editor no ve el caption; tampoco puede ver que se está redactando uno.
 * Para él la tabla de errores ES el entregable, y en cuanto está guardada
 * (estado 'redactando') esto terminó. Que el caption siga cocinándose en
 * Grok-ing no es asunto suyo.
 */

export interface VistaEstado {
  etiqueta: string
  /** Ya no hace falta seguir consultando: o acabó, o falló. */
  terminado: boolean
  fallo: boolean
}

/** Los estados en los que el editor todavía está esperando algo. */
export const EN_VUELO: ReadonlySet<EstadoFiltroI> = new Set<EstadoFiltroI>([
  'pendiente',
  'transcribiendo',
  'analizando',
])

const ETIQUETAS: Record<EstadoFiltroI, string> = {
  pendiente: 'En cola',
  transcribiendo: 'Escuchando el audio',
  analizando: 'Revisando el video',
  // Deliberadamente "Listo" y no "Redactando el caption".
  redactando: 'Listo',
  listo: 'Listo',
  error: 'Falló',
}

/**
 * El análisis terminó, pero sin haber podido oír el audio.
 *
 * Un fallo de transcripción no mata el análisis: Grok revisa igual la
 * ortografía de lo que ve en pantalla. Lo que se pierde es la comparación
 * audio↔subtítulo, y eso hay que decirlo — una tabla hecha sin oír el video
 * parece completa y no lo es.
 *
 * `status === 'error'` gana: si el análisis murió, lo que manda es el error.
 */
export function sinAudio(status: EstadoFiltroI, errorPaso: string | null): boolean {
  return errorPaso === 'transcribir' && status !== 'error'
}

export function vistaEditor(status: EstadoFiltroI): VistaEstado {
  return {
    etiqueta: ETIQUETAS[status] ?? 'En cola',
    terminado: !EN_VUELO.has(status),
    fallo: status === 'error',
  }
}
