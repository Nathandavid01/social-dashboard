/**
 * Pure builder for the idea-caption prompt. Kept out of the `'use server'`
 * action file so it can be unit-tested without mocking Supabase/Anthropic
 * (and because a `'use server'` module may only export async actions).
 */

export interface StyleExample {
  text: string
  provider: string
}

export interface IdeaCaptionPromptInput {
  title: string
  hook?: string | null
  captionAngle?: string | null
  hashtags?: string | null
  client?: {
    name?: string | null
    brandVoice?: string | null
    captionLanguage?: string | null
    defaultCta?: string | null
    captionNotes?: string | null
  } | null
  /**
   * The client's networks. ONE caption is written for ALL of them (caption único);
   * if omitted/empty the prompt uses generic "todas las redes" wording.
   */
  platforms?: string[]
  /** Past published captions for this client, pulled from Metricool, to imitate. */
  examples: StyleExample[]
}

const filled = (s?: string | null): boolean => !!s && s.trim().length > 0

/** Build the full prompt sent to the model for a single idea's caption. */
export function buildIdeaCaptionPrompt(input: IdeaCaptionPromptInput): string {
  const { title, hook, captionAngle, hashtags, examples } = input
  const c = input.client ?? {}

  const nets = (input.platforms ?? []).filter((p) => filled(p))
  const redes = nets.length > 0 ? nets.join(', ') : 'todas las redes del cliente'

  const constraints = [
    filled(c.captionLanguage) && `Idioma: ${c.captionLanguage} (IMPORTANTE: escribe el caption en este idioma)`,
    filled(c.brandVoice) && `Voz de marca: ${c.brandVoice}`,
    filled(c.defaultCta) && `CTA preferido: ${c.defaultCta}`,
    filled(c.captionNotes) && `Reglas a seguir: ${c.captionNotes}`,
  ]
    .filter(Boolean)
    .join('\n')

  const examplesBlock =
    examples.length > 0
      ? `CAPTIONS DE REFERENCIA (ya publicados de este cliente — imita exactamente este estilo, tono, largo, emojis y formato de hashtags):\n\n${examples
          .map((ex, i) => `--- Ejemplo ${i + 1} (${ex.provider}) ---\n${ex.text}`)
          .join('\n\n')}`
      : 'No hay captions previos de este cliente. Escribe en un estilo natural y atractivo de redes en Puerto Rico.'

  const ideaLines = [
    `- Título: ${title}`,
    filled(hook) && `- Hook: ${hook}`,
    filled(captionAngle) && `- Ángulo del caption: ${captionAngle}`,
    filled(hashtags) && `- Hashtags sugeridos: ${hashtags}`,
  ]
    .filter(Boolean)
    .join('\n')

  const imitationBullet =
    examples.length > 0
      ? '- Imita el tono, el largo, el uso de emojis y el formato de hashtags de los CAPTIONS DE REFERENCIA de arriba\n'
      : ''

  return `Eres un copywriter profesional de redes sociales para NMedia PR, agencia de marketing puertorriqueña. Escribes captions que rinden bien en Instagram, TikTok y Facebook.

CLIENTE: ${filled(c.name) ? c.name : 'cliente'}
REDES: ${redes} (escribe UN SOLO caption que funcione igual en todas)

LA IDEA DEL VIDEO:
${ideaLines}

${constraints ? `RESTRICCIONES:\n${constraints}\n\n` : ''}${examplesBlock}

TAREA: Escribe UN SOLO caption completo para este video, que sirva igual en todas las redes indicadas.
${imitationBullet}- Engancha en la primera línea
- Incluye un CTA claro
- Termina con hashtags relevantes (usa los sugeridos si encajan)
- Devuelve SOLO el caption, sin explicaciones ni comillas.`
}
