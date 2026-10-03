import type { ClientSuggestion, ClientSuggestionSource } from '@/lib/supabase/types'

export const CLIENT_SUGGESTION_SOURCES: ClientSuggestionSource[] = [
  'whatsapp',
  'mensaje',
  'otro',
]

export const CLIENT_SUGGESTION_SOURCE_LABELS: Record<ClientSuggestionSource, string> = {
  whatsapp: 'WhatsApp',
  mensaje: 'Mensaje',
  otro: 'Otro',
}

export const CLIENT_SUGGESTION_MAX_BODY = 4000

/** Spanish label for a suggestion source. Unknown values fall back to "Otro". */
export function formatSuggestionSource(source: string | null | undefined): string {
  if (source && source in CLIENT_SUGGESTION_SOURCE_LABELS) {
    return CLIENT_SUGGESTION_SOURCE_LABELS[source as ClientSuggestionSource]
  }
  return CLIENT_SUGGESTION_SOURCE_LABELS.otro
}

/** Normalize and validate body + source for insert. Pure — no I/O. */
export function normalizeSuggestionInput(input: {
  body?: unknown
  source?: unknown
}): { ok: true; body: string; source: ClientSuggestionSource } | { ok: false; error: string } {
  const rawBody = typeof input.body === 'string' ? input.body : ''
  const body = rawBody.trim()
  if (!body) return { ok: false, error: 'Escribe la sugerencia del cliente.' }
  if (body.length > CLIENT_SUGGESTION_MAX_BODY) {
    return { ok: false, error: `Máximo ${CLIENT_SUGGESTION_MAX_BODY} caracteres.` }
  }

  const rawSource = typeof input.source === 'string' ? input.source : 'whatsapp'
  if (!CLIENT_SUGGESTION_SOURCES.includes(rawSource as ClientSuggestionSource)) {
    return { ok: false, error: 'Fuente no válida.' }
  }

  return { ok: true, body, source: rawSource as ClientSuggestionSource }
}

/** Newest-first list (stable if already sorted). Pure helper for UI/tests. */
export function sortSuggestionsNewestFirst<T extends Pick<ClientSuggestion, 'created_at'>>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

/** Cap for the compact "Lo que dijo el cliente" panel. */
export function recentSuggestions<T>(items: T[], limit = 8): T[] {
  return items.slice(0, Math.max(0, limit))
}
