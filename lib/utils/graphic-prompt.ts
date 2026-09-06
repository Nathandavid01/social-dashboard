import type { BrandColors, BrandFonts } from '@/lib/supabase/types'

/**
 * Pure builder of the Grok Imagine prompt for a client graphic. Same split as
 * idea-caption-prompt.ts: the server action fetches the data, this assembles
 * the text. Prompt is English (models follow it better) but the text rendered
 * INSIDE the image follows the client's caption_language.
 */
export interface GraphicPromptInput {
  /** What the team wants the graphic to say/show, in their own words. */
  concept: string
  clientName: string
  industry?: string | null
  brandVoice?: string | null
  /** 'spanish' | 'english' | free text; defaults to spanish (es-PR agency). */
  captionLanguage?: string | null
  brandColors?: BrandColors | null
  brandFonts?: BrandFonts | null
  captionNotes?: string | null
  /** True when the team attached their own photo as the base (image-to-image). */
  fromPhoto?: boolean
}

function colorLines(colors: BrandColors | null | undefined): string[] {
  if (!colors) return []
  const entries: [string, string | null | undefined][] = [
    ['primary', colors.primary],
    ['secondary', colors.secondary],
    ['accent', colors.accent],
    ['text', colors.text],
  ]
  return entries
    .filter(([, v]) => typeof v === 'string' && v.trim().length > 0)
    .map(([k, v]) => `- ${k}: ${(v as string).trim()}`)
}

export function buildGraphicPrompt(input: GraphicPromptInput): string {
  const lang = (input.captionLanguage ?? '').trim().toLowerCase() === 'english' ? 'English' : 'Spanish'

  const lines: string[] = [
    input.fromPhoto
      ? 'Transform the provided photo into a polished social media graphic for a client of a marketing agency.'
      : 'Design a polished social media graphic for a client of a marketing agency.',
    '',
    `Client: ${input.clientName}${input.industry?.trim() ? ` (industry: ${input.industry.trim()})` : ''}`,
    `What the graphic is about: ${input.concept.trim()}`,
  ]

  if (input.brandVoice?.trim()) {
    lines.push('', `Brand voice / personality: ${input.brandVoice.trim()}`)
  }

  const colors = colorLines(input.brandColors)
  if (colors.length > 0) {
    lines.push('', 'Brand colors (use these as the dominant palette):', ...colors)
  }

  const primaryFont = input.brandFonts?.primary?.trim()
  const secondaryFont = input.brandFonts?.secondary?.trim()
  if (primaryFont || secondaryFont) {
    const parts = [
      primaryFont ? `headlines in a typeface closely resembling "${primaryFont}"` : null,
      secondaryFont ? `supporting text closely resembling "${secondaryFont}"` : null,
    ].filter(Boolean)
    lines.push('', `Brand typography: ${parts.join('; ')}.`)
  }

  if (input.captionNotes?.trim()) {
    lines.push('', `Extra brand notes from the agency: ${input.captionNotes.trim()}`)
  }

  lines.push(
    '',
    'Requirements:',
    `- Any visible text in the image must be in ${lang}, short and punchy, with flawless spelling.`,
    ...(input.fromPhoto
      ? [
          '- Keep the subject of the photo clearly recognizable and prominent; enhance lighting and composition, add branded overlays/text, but never replace the real subject with a generated one.',
        ]
      : []),
    '- Modern, professional advertising quality — strong typography, clear hierarchy, generous negative space.',
    '- Do not invent or draw any logo, watermark or brand mark; leave clean space where a logo could be placed later.',
    '- No borders or device mockups; the artwork fills the full canvas.',
  )

  return lines.join('\n')
}
