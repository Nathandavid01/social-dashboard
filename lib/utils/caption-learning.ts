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

/**
 * Merge 👍-loved captions AHEAD of plain-approved ones, deduped (case/whitespace),
 * blanks/too-short dropped, capped. Loved lead because an explicit 👍 is the
 * strongest positive signal. Order is preserved exactly (no recency tricks).
 */
export function mergeApprovedAndLoved(loved: string[], approved: string[], limit = 6): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of [...loved, ...approved]) {
    const text = (raw ?? '').trim()
    if (text.length < 20) continue
    const key = text.toLowerCase().replace(/\s+/g, ' ')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(text)
    if (out.length >= limit) break
  }
  return out
}

/**
 * Find 👎 feedback notes that REPEAT for a client (e.g. "menos emojis" written 3
 * times) — the signal that it should become a standing rule in caption_notes.
 * Normalizes (lowercase, collapse whitespace), counts, keeps those ≥ minCount,
 * most-frequent first. Returns the first-seen original casing as the phrase.
 */
export function detectRecurringFeedback(
  notes: (string | null | undefined)[],
  opts?: { minCount?: number; limit?: number },
): { phrase: string; count: number }[] {
  const minCount = opts?.minCount ?? 2
  const limit = opts?.limit ?? 3
  const counts = new Map<string, { phrase: string; count: number }>()
  for (const raw of notes) {
    const text = (raw ?? '').trim()
    if (text.length < 3) continue
    const key = text.toLowerCase().replace(/\s+/g, ' ')
    const entry = counts.get(key)
    if (entry) entry.count++
    else counts.set(key, { phrase: text, count: 1 })
  }
  return Array.from(counts.values())
    .filter((e) => e.count >= minCount)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
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
