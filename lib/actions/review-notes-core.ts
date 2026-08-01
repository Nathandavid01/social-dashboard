/**
 * Las correcciones que el revisor pide, resumidas por video.
 *
 * `decideReview` obligaba a escribir qué cambiar y luego tiraba el texto: la
 * tarjeta volvía a Editado con la etiqueta "Cambios pedidos" y nada más, así que
 * el editor reenviaba el mismo video sin saber qué corregir. Ahora cada decisión
 * deja una fila en content_idea_activity y esto se queda con la última.
 *
 * Módulo aparte y puro para poder probarlo sin base de datos.
 */

export interface ReviewNoteRow {
  content_idea_id: string
  /** `cliente` solo viene cuando la pidió el cliente desde su enlace. */
  metadata: { note?: string; cliente?: string } | null
  created_at: string
  user: { full_name: string | null } | null
}

export interface ReviewNote {
  note: string
  author: string | null
  at: string
}

/**
 * La última corrección de cada video. Un video puede volver varias veces, y lo
 * que hay que leer es lo último que se pidió, no la primera ronda.
 */
export function latestNoteByIdea(rows: ReviewNoteRow[]): Record<string, ReviewNote> {
  const out: Record<string, ReviewNote> = {}
  for (const r of rows) {
    const note = r.metadata?.note?.trim()
    // Sin texto no hay nada que enseñar: una caja vacía en la tarjeta es peor
    // que ninguna caja.
    if (!note) continue
    const prev = out[r.content_idea_id]
    if (prev && prev.at >= r.created_at) continue
    // El cliente no es un profile: su nombre viaja en metadata. Sin esto la
    // caja saldría sin autor justo cuando más importa saber quién lo pidió.
    const author = r.metadata?.cliente ?? r.user?.full_name ?? null
    out[r.content_idea_id] = { note, author, at: r.created_at }
  }
  return out
}
