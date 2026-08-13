/** Read leftover v3.24 per-network JSON in `caption_draft`. New drafts are plain text. */

export type CaptionDraftItem = { platform: string; text: string }

export function packCaptionDrafts(items: CaptionDraftItem[]): string {
  const by: Record<string, string> = {}
  for (const item of items) {
    const text = item.text.trim()
    if (!text) continue
    by[item.platform] = text
  }
  return JSON.stringify({ by })
}

export function parseCaptionDrafts(raw: string | null | undefined): CaptionDraftItem[] {
  const s = (raw ?? '').trim()
  if (!s) return []
  try {
    const parsed = JSON.parse(s) as { by?: unknown }
    if (parsed && typeof parsed === 'object' && parsed.by && typeof parsed.by === 'object' && !Array.isArray(parsed.by)) {
      return Object.entries(parsed.by as Record<string, unknown>)
        .filter(([, text]) => typeof text === 'string' && text.trim().length > 0)
        .map(([platform, text]) => ({ platform, text: (text as string).trim() }))
    }
  } catch {
    /* plain-text drafts from before per-network packing */
  }
  return [{ platform: 'all', text: s }]
}

/** What the textarea shows. Always one caption — leftover JSON from v3.24 is flattened. */
export function displayCaptionDraft(raw: string | null | undefined): string {
  const items = parseCaptionDrafts(raw)
  if (items.length === 0) return ''
  const preferred =
    items.find((item) => item.platform === 'instagram') ??
    items.find((item) => item.platform === 'all') ??
    items[0]
  return preferred.text
}
