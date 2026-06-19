/**
 * Pure selection of a client's APPROVED captions to feed back into the caption
 * generator (the per-client learning loop): each approved caption is the team's
 * own "this is right for this client" signal, so future captions imitate them.
 *
 * Kept Supabase-free so it's unit-testable; the DB fetch lives in
 * lib/integrations/caption-learning.ts.
 */

export interface ApprovedCaptionRow {
  text: string | null
  /** Sortable recency key (ISO date/timestamp); newest wins. */
  recency?: string | null
}

/**
 * Dedup (case/whitespace-insensitive), drop blanks/too-short, sort newest-first,
 * and cap. Mirrors the >20-char floor used for Metricool style examples.
 */
export function selectApprovedExamples(rows: ApprovedCaptionRow[], limit = 6): string[] {
  const seen = new Set<string>()
  const kept: { text: string; recency: string }[] = []

  for (const r of rows) {
    const text = (r.text ?? '').trim()
    if (text.length < 20) continue
    const key = text.toLowerCase().replace(/\s+/g, ' ')
    if (seen.has(key)) continue
    seen.add(key)
    kept.push({ text, recency: r.recency ?? '' })
  }

  kept.sort((a, b) => (a.recency < b.recency ? 1 : a.recency > b.recency ? -1 : 0))
  return kept.slice(0, limit).map((k) => k.text)
}

export interface AvoidCaptionRow {
  text: string | null
  note?: string | null
  recency?: string | null
}

/**
 * Captions the team rated 👎 (with the reason, when given) for the "avoid this"
 * block. Same hygiene as the approved selection: dedup, drop blanks/too-short,
 * newest-first, cap (smaller — negative signal needs fewer examples).
 */
export function selectAvoidExamples(
  rows: AvoidCaptionRow[],
  limit = 4,
): { text: string; note: string | null }[] {
  const seen = new Set<string>()
  const kept: { text: string; note: string | null; recency: string }[] = []

  for (const r of rows) {
    const text = (r.text ?? '').trim()
    if (text.length < 20) continue
    const key = text.toLowerCase().replace(/\s+/g, ' ')
    if (seen.has(key)) continue
    seen.add(key)
    const note = (r.note ?? '').trim()
    kept.push({ text, note: note || null, recency: r.recency ?? '' })
  }

  kept.sort((a, b) => (a.recency < b.recency ? 1 : a.recency > b.recency ? -1 : 0))
  return kept.slice(0, limit).map(({ text, note }) => ({ text, note }))
}
