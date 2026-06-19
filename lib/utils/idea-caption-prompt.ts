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
  visualBrief?: string | null
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
  /**
   * Captions the team has APPROVED for this client (learning loop). The exact
   * standard to match — weighted above the Metricool reference examples.
   */
  approvedExamples?: string[]
  /**
   * Captions the team rated 👎 for this client (with the reason, when given) —
   * the "do NOT write like this" signal.
   */
  avoidExamples?: { text: string; note?: string | null }[]
  /** User instructions to revise a prior attempt ("más corto", "menos emojis", "más CTA"). */
  feedback?: string | null
  /** The previous caption being revised — shown to the model so it improves on it. */
  previousCaption?: string | null
}

const filled = (s?: string | null): boolean => !!s && s.trim().length > 0

/** Build the full prompt sent to the model for a single idea's caption. */
export function buildIdeaCaptionPrompt(input: IdeaCaptionPromptInput): string {
  const { title, hook, visualBrief, captionAngle, hashtags, examples } = input
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
    filled(visualBrief) && `- Brief visual (qué grabar): ${visualBrief}`,
    filled(captionAngle) && `- Ángulo del caption: ${captionAngle}`,
    filled(hashtags) && `- Hashtags sugeridos: ${hashtags}`,
  ]
    .filter(Boolean)
    .join('\n')

  const imitationBullet =
    examples.length > 0
      ? '- Imita el tono, el largo, el uso de emojis y el formato de hashtags de los CAPTIONS DE REFERENCIA de arriba\n'
      : ''

  // Learning loop: captions the team APPROVED for this client are the exact
  // standard to match — weighted above the Metricool reference examples.
  const approved = (input.approvedExamples ?? []).filter((s) => filled(s))
  const approvedBlock =
    approved.length > 0
      ? `CAPTIONS QUE EL EQUIPO YA APROBÓ PARA ESTE CLIENTE (este es el estándar exacto a igualar — síguelos por encima de los de referencia):\n\n${approved
          .map((t, i) => `--- Aprobado ${i + 1} ---\n${t}`)
          .join('\n\n')}\n\n`
      : ''
  const approvedBullet =
    approved.length > 0
      ? '- Da MÁXIMA prioridad al estilo de los CAPTIONS QUE EL EQUIPO YA APROBÓ — el equipo ya validó que así es como suena este cliente\n'
      : ''

  // Negative signal: captions the team rated 👎 (with the reason when given).
  const avoid = (input.avoidExamples ?? []).filter((a) => filled(a?.text))
  const avoidBlock =
    avoid.length > 0
      ? `CAPTIONS QUE EL EQUIPO RECHAZÓ PARA ESTE CLIENTE (NO escribas así — aprende del error):\n\n${avoid
          .map((a, i) => `--- Rechazado ${i + 1}${filled(a.note) ? ` (motivo: ${a.note!.trim()})` : ''} ---\n${a.text.trim()}`)
          .join('\n\n')}\n\n`
      : ''
  const avoidBullet =
    avoid.length > 0
      ? '- EVITA el estilo/los errores de los CAPTIONS QUE EL EQUIPO RECHAZÓ\n'
      : ''

  // When the user gives feedback on a prior attempt, show that attempt + the
  // instructions so the model revises instead of starting from scratch.
  const feedbackBlock = filled(input.feedback)
    ? `FEEDBACK DEL EQUIPO SOBRE EL INTENTO ANTERIOR (aplica estos cambios al reescribir):\n${input.feedback!.trim()}\n\n${
        filled(input.previousCaption)
          ? `CAPTION ANTERIOR (mejóralo según el feedback, no lo copies tal cual):\n${input.previousCaption!.trim()}\n\n`
          : ''
      }`
    : ''
  const feedbackBullet = filled(input.feedback)
    ? '- Aplica el FEEDBACK DEL EQUIPO de arriba manteniendo el mensaje central de la idea\n'
    : ''

  return `Eres un copywriter profesional de redes sociales para NMedia PR, agencia de marketing puertorriqueña. Escribes captions que rinden bien en Instagram, TikTok y Facebook.

CLIENTE: ${filled(c.name) ? c.name : 'cliente'}
REDES: ${redes} (escribe UN SOLO caption que funcione igual en todas)

LA IDEA DEL VIDEO:
${ideaLines}

${constraints ? `RESTRICCIONES:\n${constraints}\n\n` : ''}${approvedBlock}${avoidBlock}${feedbackBlock}${examplesBlock}

TAREA: Escribe UN SOLO caption completo para este video, que sirva igual en todas las redes indicadas.
El caption debe alinearse con el hook y el brief visual — el video se grabará siguiendo esa idea.
${approvedBullet}${avoidBullet}${feedbackBullet}${imitationBullet}- Engancha en la primera línea
- Incluye un CTA claro
- Termina con hashtags relevantes (usa los sugeridos si encajan)
- Devuelve SOLO el caption, sin explicaciones ni comillas.`
}
