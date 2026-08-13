/** Persist one AI draft per network in `content_ideas.caption_draft` until 0030 lands. */

export type CaptionDraftItem = { platform: string; text: string }

const LABEL: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  all: 'Todas las redes',
}

export function platformDraftLabel(platform: string): string {
  return LABEL[platform] ?? platform
}

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

/** What the single textarea shows. One draft = the text; several = labeled blocks. */
export function displayCaptionDraft(raw: string | null | undefined): string {
  const items = parseCaptionDrafts(raw)
  if (items.length === 0) return ''
  if (items.length === 1) return items[0].text
  return items
    .map((item) => `[${platformDraftLabel(item.platform)}]\n${item.text}`)
    .join('\n\n')
}
