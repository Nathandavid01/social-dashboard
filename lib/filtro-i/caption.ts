import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchClientStyleExamples } from '@/lib/integrations/metricool-style'
import {
  fetchApprovedCaptionExamples,
  fetchCaptionFeedbackForPrompt,
} from '@/lib/integrations/caption-learning'
import { mergeApprovedAndLoved } from '@/lib/utils/caption-learning'
import { buildIdeaCaptionPrompt } from '@/lib/utils/idea-caption-prompt'
import { resolvePlatforms } from '@/lib/utils/idea-posting-core'
import { generateCaptionText, captionConfigError } from '@/lib/llm/caption-llm'

/**
 * El Caption Base de Grok pasa por el agente de captions que ya existe.
 *
 * Reusa exactamente el mismo cerebro que `generateIdeaCaption`: el historial
 * publicado del cliente en Metricool, los captions que el equipo aprobó y los
 * que rechazó. Lo único que cambia es de dónde sale el contenido (el video ya
 * editado, no el brief) y dónde acaba el resultado.
 *
 * Deliberadamente NO escribe en `content_ideas.generated_caption`: ese campo lo
 * lee la etapa Copy de /entregas, y el caption de Filtro I todavía no entra ahí
 * — vive en Grok-ing hasta que se integren. El llamador lo guarda en
 * `filtro_i_analisis.caption_final`.
 */
export async function generarCaptionFinal(input: {
  supabase: SupabaseClient
  ideaId: string
  captionBase: string
}): Promise<string> {
  const configError = captionConfigError(process.env)
  if (configError) throw new Error(configError)

  const { data: idea } = await input.supabase
    .from('content_ideas')
    .select(
      'id, client_id, title, hook, visual_brief, caption_angle, hashtags_suggestion, client:clients(name, brand_voice, caption_language, default_cta, caption_notes, metricool_blog_id, platforms, default_platforms)',
    )
    .eq('id', input.ideaId)
    .single()

  if (!idea) throw new Error('Idea no encontrada')

  const client = (idea.client ?? {}) as {
    name?: string
    brand_voice?: string | null
    caption_language?: string | null
    default_cta?: string | null
    caption_notes?: string | null
    metricool_blog_id?: string | null
    platforms?: string[] | null
    default_platforms?: string[] | null
  }

  const clientId = (idea as { client_id?: string | null }).client_id

  // El bucle de aprendizaje, igual que en generateIdeaCaption. Best-effort las
  // tres: si Metricool está caído el caption sale igual, con menos estilo.
  const [examples, approved, ratings] = await Promise.all([
    fetchClientStyleExamples(client.metricool_blog_id ?? undefined),
    fetchApprovedCaptionExamples(input.supabase, clientId, { excludeId: idea.id }),
    fetchCaptionFeedbackForPrompt(input.supabase, clientId),
  ])

  const prompt = buildIdeaCaptionPrompt({
    title: idea.title,
    hook: idea.hook,
    visualBrief: idea.visual_brief,
    captionAngle: idea.caption_angle,
    hashtags: idea.hashtags_suggestion,
    platforms: resolvePlatforms(client.platforms, client.default_platforms),
    examples,
    approvedExamples: mergeApprovedAndLoved(ratings.loved, approved),
    avoidExamples: ratings.avoid,
    // Lo que el video de verdad dice. Manda sobre el brief.
    captionBase: input.captionBase,
    client: {
      name: client.name,
      brandVoice: client.brand_voice,
      captionLanguage: client.caption_language,
      defaultCta: client.default_cta,
      captionNotes: client.caption_notes,
    },
  })

  const caption = await generateCaptionText(prompt)
  if (!caption) throw new Error('La IA no devolvió caption')
  return caption
}
