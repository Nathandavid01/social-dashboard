/**
 * Aprendizaje por corrección (Pieza 3): cuando el equipo edita el caption que
 * escribió la IA antes de guardarlo, esa diferencia es la mejor señal de
 * aprendizaje que hay — y es POR CLIENTE (ver supabase/migrations/0066).
 *
 * Puro y sin Supabase para poder probarlo sin mocks; el fetch vive en
 * lib/integrations/caption-corrections.ts.
 */

const normalize = (s: string | null | undefined): string =>
  (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * Solo cuenta como "corrección" si el texto cambió de verdad, no cuando
 * el equipo únicamente reformateó espacios/mayúsculas — eso es ruido, no
 * aprendizaje, y guardarlo infla la tabla sin dar ninguna señal útil.
 */
export function huboCambioSignificativo(draft: string | null | undefined, final: string | null | undefined): boolean {
  const d = normalize(draft)
  const f = normalize(final)
  if (!f) return false
  return d !== f
}

export interface CorrectionRow {
  draftText: string | null
  finalText: string | null
  /** Sortable recency key (ISO date/timestamp); newest wins. */
  recency?: string | null
}

export interface CaptionCorrection {
  draft: string
  final: string
}

/**
 * Selecciona las correcciones más recientes de un cliente para meterlas en el
 * prompt: descarta filas sin texto final, ordena por más reciente primero,
 * corta al límite (3-5 en el prompt real) y trunca cada texto a `maxLen`
 * caracteres para no inflar el prompt con correcciones larguísimas.
 */
export function seleccionarCorrecciones(
  rows: CorrectionRow[],
  limit = 5,
  maxLen = 220,
): CaptionCorrection[] {
  const truncate = (s: string): string => (s.length > maxLen ? `${s.slice(0, maxLen)}…` : s)

  return rows
    .filter((r) => (r.finalText ?? '').trim().length > 0)
    .slice()
    .sort((a, b) => ((a.recency ?? '') < (b.recency ?? '') ? 1 : (a.recency ?? '') > (b.recency ?? '') ? -1 : 0))
    .slice(0, limit)
    .map((r) => ({
      draft: truncate((r.draftText ?? '').trim()),
      final: truncate((r.finalText ?? '').trim()),
    }))
}
