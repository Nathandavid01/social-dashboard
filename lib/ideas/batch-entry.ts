import type { ShotTypeKey } from '@/lib/onsite/shot-types'

/**
 * Escritura de ideas en lote — lo que antes era el documento PDF.
 *
 * La tabla siempre lleva una fila vacía al final para poder seguir tecleando.
 * Esas filas NO se guardan: la regla de qué cuenta como idea escrita vive aquí,
 * no repartida por la interfaz, para que no discrepen.
 */

export const FUNNEL_STAGES = [
  { key: 'TOFU', label: 'TOFU' },
  { key: 'MOFU', label: 'MOFU' },
  { key: 'BOFU', label: 'BOFU' },
] as const

export type FunnelStageKey = (typeof FUNNEL_STAGES)[number]['key']

export interface IdeaRow {
  title: string
  objective: string
  funnelStage: string
  hook: string
  contentType: string
  shotType: string
  referenceUrl: string
}

export const emptyIdeaRow = (): IdeaRow => ({
  title: '',
  objective: '',
  funnelStage: '',
  hook: '',
  contentType: 'R',
  shotType: '',
  referenceUrl: '',
})

export interface IdeaRowPayload {
  title: string
  objective: string | null
  funnelStage: string | null
  hook: string | null
  contentType: string
  shotType: ShotTypeKey | null
  referenceUrl: string | null
}

/**
 * Una fila cuenta como idea si tiene título O "de qué es". Exigir las dos
 * frenaría a quien escribe rápido y aún no sabe cómo titularla; no exigir
 * ninguna guardaría filas en blanco.
 */
export function rowIsWritten(r: IdeaRow): boolean {
  return r.title.trim().length > 0 || r.hook.trim().length > 0
}

/** Cuántas ideas de verdad hay escritas en la tabla. */
export function countWritten(rows: IdeaRow[]): number {
  return rows.filter(rowIsWritten).length
}

/**
 * Lo que se manda al servidor. Sin título, el "de qué es" hace de título: una
 * tarjeta sin nombre es ilegible en el tablero.
 */
export function toPayload(rows: IdeaRow[]): IdeaRowPayload[] {
  return rows.filter(rowIsWritten).map((r) => {
    const title = r.title.trim() || r.hook.trim()
    return {
      title,
      objective: r.objective.trim() || null,
      funnelStage: r.funnelStage.trim() || null,
      hook: r.hook.trim() || null,
      contentType: r.contentType || 'R',
      shotType: (r.shotType || null) as ShotTypeKey | null,
      referenceUrl: r.referenceUrl.trim() || null,
    }
  })
}

/**
 * ¿La fila tiene algo tecleado (aunque aún no cuente como idea guardable)?
 * Sirve para no borrar objetivo/embudo/toma mientras el escritor aún no puso título.
 */
export function rowHasDraftContent(r: IdeaRow): boolean {
  return (
    rowIsWritten(r) ||
    r.objective.trim().length > 0 ||
    r.funnelStage.trim().length > 0 ||
    r.shotType.trim().length > 0 ||
    r.referenceUrl.trim().length > 0 ||
    (r.contentType.trim().length > 0 && r.contentType !== 'R')
  )
}

/**
 * Mantiene exactamente UNA fila vacía al final. Sin esto hay que pulsar
 * "añadir fila" por cada idea, que es la friccion que hacía preferir el
 * documento.
 */
export function withTrailingBlank(rows: IdeaRow[]): IdeaRow[] {
  const kept = rows.filter(rowHasDraftContent)
  return [...kept, emptyIdeaRow()]
}
