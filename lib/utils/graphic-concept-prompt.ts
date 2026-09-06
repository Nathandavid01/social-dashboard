/**
 * Pure builder of the "mejorar descripción" prompt: Grok (texto o visión)
 * convierte la idea cruda del equipo en una descripción rica para Grok
 * Imagine. La respuesta queda editable en el textarea — el humano aprueba
 * antes de generar; por eso la salida se exige en español (idioma del equipo).
 */
export interface ConceptEnhanceInput {
  /** La idea cruda del equipo, tal cual la escribieron. */
  concept: string
  clientName: string
  industry?: string | null
  brandVoice?: string | null
  captionNotes?: string | null
  /** True cuando hay foto adjunta: el modelo de visión la describe también. */
  hasPhoto?: boolean
}

export function buildConceptEnhancePrompt(input: ConceptEnhanceInput): string {
  const lines: string[] = [
    'You help a social media agency write descriptions for an AI image generator.',
    'Rewrite the team\'s rough idea below into ONE rich, specific description for a social media graphic.',
    '',
    `Client: ${input.clientName}${input.industry?.trim() ? ` (industry: ${input.industry.trim()})` : ''}`,
    `Rough idea from the team: ${input.concept.trim()}`,
  ]

  if (input.brandVoice?.trim()) lines.push(`Brand voice: ${input.brandVoice.trim()}`)
  if (input.captionNotes?.trim()) lines.push(`Agency notes: ${input.captionNotes.trim()}`)

  if (input.hasPhoto) {
    lines.push(
      '',
      'The team also provided the attached photo as the base for the graphic. Look at it and ground the description in what the photo actually shows (subject, setting, lighting), describing how to turn THIS photo into the graphic.',
    )
  }

  lines.push(
    '',
    'Rules for the description:',
    '- Write it in Spanish, 1 to 3 sentences, concrete and visual.',
    '- Include the exact overlay text the graphic should display, in quotes (short and punchy; keep any price or date from the rough idea EXACTLY as written).',
    '- Describe scene, ambiance and style consistent with the brand.',
    '- Reply with only the improved description — no preamble, no options, no explanations.',
  )

  return lines.join('\n')
}
