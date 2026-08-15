/**
 * Enlace "Ver post enviado" de una tarjeta de Entregas.
 *
 * La fuente de verdad es el log de actividad (`posted_to_metricool`): su
 * metadata.publicUrl es la URL exacta que Metricool recibió — no se recalcula
 * desde los archivos actuales, porque el punto del enlace es verificar lo que
 * SE ENVIÓ aunque después alguien suba otro corte.
 */

export interface PostedActivityRow {
  content_idea_id: string
  created_at: string
  /** jsonb ya parseado por Supabase, igual que en review-notes-core. */
  metadata: unknown
}

/** idea id → URL pública enviada a Metricool (solo http/https). */
export type PostedLinks = Record<string, string>

function publicUrlOf(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null
  const url = (metadata as { publicUrl?: unknown }).publicUrl
  if (typeof url !== 'string') return null
  return /^https?:\/\//.test(url) ? url : null
}

/**
 * Un enlace por idea: el del envío MÁS RECIENTE que traiga publicUrl. Los
 * posts anteriores a v3.32 no lo registraban — esas ideas quedan sin enlace
 * (la tarjeta sigue igual que hoy), y un reenvío sin URL no borra la del
 * envío anterior.
 */
export function buildPostedLinks(rows: PostedActivityRow[]): PostedLinks {
  const newest = new Map<string, { url: string; at: string }>()
  for (const r of rows) {
    const url = publicUrlOf(r.metadata)
    if (!url) continue
    const prev = newest.get(r.content_idea_id)
    if (!prev || r.created_at > prev.at) newest.set(r.content_idea_id, { url, at: r.created_at })
  }
  return Object.fromEntries(Array.from(newest, ([id, v]) => [id, v.url]))
}
