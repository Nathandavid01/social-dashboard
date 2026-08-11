import { emptyIdeaRow, rowIsWritten, withTrailingBlank, type IdeaRow } from './batch-entry'

/**
 * Borrador de "Escribir ideas": lo tecleado y todavía no enviado, guardado por
 * persona y cliente.
 *
 * Existe porque la tabla vivía en estado local y cambiar de cliente no la
 * reiniciaba: lo escrito para un cliente terminaba guardado en otro. Ahora cada
 * cliente tiene lo suyo y no se pierde al cambiar, recargar o cerrar.
 */

/** ¿Hay algo tecleado que aún no se ha enviado? Decide si se avisa al salir. */
export function hayTrabajoSinEnviar(rows: IdeaRow[]): boolean {
  return rows.some(rowIsWritten)
}

/** Lo que se persiste: solo filas con contenido — la vacía del final no es trabajo. */
export function rowsParaBorrador(rows: IdeaRow[]): IdeaRow[] {
  return rows.filter(rowIsWritten)
}

/**
 * Reabrir un borrador. Lo que viene de la base puede ser de una versión vieja
 * del formulario, así que cada fila se normaliza contra la fila vacía actual en
 * vez de confiar en su forma.
 */
export function rowsDesdeBorrador(guardadas: IdeaRow[] | null | undefined): IdeaRow[] {
  const limpias = (Array.isArray(guardadas) ? guardadas : [])
    .filter((r): r is IdeaRow => !!r && typeof r === 'object')
    .map((r) => ({ ...emptyIdeaRow(), ...r }))
    .filter(rowIsWritten)

  return withTrailingBlank(limpias)
}
