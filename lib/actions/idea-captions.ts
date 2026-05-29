'use server'

import Anthropic from '@anthropic-ai/sdk'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { logIdeaActivity } from '@/lib/utils/idea-activity'

const CAPTION_MODEL = 'claude-sonnet-4-6'

/**
 * Generate a caption for a specific idea, grounded in the idea's hook +
 * caption_angle + suggested hashtags AND the client's brand voice.
 * Saves the result to content_ideas.generated_caption.
 */
export async function generateIdeaCaption(
  ideaId: string,
  platform = 'instagram',
): Promise<{ ok?: true; caption?: string; error?: string }> {
  try {
    await requirePermission('captions.use')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: 'ANTHROPIC_API_KEY no está configurado en el servidor.' }
  }

  const supabase = await createClient()
  const { data: idea } = await supabase
    .from('content_ideas')
    .select('id, title, hook, caption_angle, hashtags_suggestion, content_type, client:clients(name, brand_voice, caption_language, default_cta, default_hashtags, caption_notes)')
    .eq('id', ideaId)
    .single()

  if (!idea) return { error: 'Idea no encontrada' }

  const client = (idea.client ?? {}) as {
    name?: string
    brand_voice?: string | null
    caption_language?: string | null
    default_cta?: string | null
    default_hashtags?: string | null
    caption_notes?: string | null
  }

  const constraints = [
    client.caption_language && `Idioma: ${client.caption_language} (IMPORTANTE: escribe el caption en este idioma)`,
    client.brand_voice && `Voz de marca: ${client.brand_voice}`,
    client.default_cta && `CTA preferido: ${client.default_cta}`,
    client.caption_notes && `Reglas a seguir: ${client.caption_notes}`,
  ].filter(Boolean).join('\n')

  const prompt = `Eres un copywriter profesional de redes sociales para NMedia PR, agencia de marketing puertorriqueña. Escribes captions que rinden bien en Instagram, TikTok y Facebook.

CLIENTE: ${client.name ?? 'cliente'}
PLATAFORMA: ${platform}

LA IDEA DEL VIDEO:
- Título: ${idea.title}
${idea.hook ? `- Hook: ${idea.hook}` : ''}
${idea.caption_angle ? `- Ángulo del caption: ${idea.caption_angle}` : ''}
${idea.hashtags_suggestion ? `- Hashtags sugeridos: ${idea.hashtags_suggestion}` : ''}

${constraints ? `RESTRICCIONES:\n${constraints}\n` : ''}
TAREA: Escribe UN caption completo para este video, alineado con el hook y el ángulo de arriba.
- Engancha en la primera línea
- Incluye un CTA claro
- Termina con hashtags relevantes (usa los sugeridos si encajan)
- Devuelve SOLO el caption, sin explicaciones ni comillas.`

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await anthropic.messages.create({
      model: CAPTION_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })
    const caption = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()

    if (!caption) return { error: 'La IA no devolvió caption' }

    const { error: updErr } = await supabase
      .from('content_ideas')
      .update({
        generated_caption: caption,
        caption_platform: platform,
        caption_generated_at: new Date().toISOString(),
      })
      .eq('id', ideaId)
    if (updErr) return { error: updErr.message }

    await logIdeaActivity(supabase, { ideaId, action: 'caption_generated', metadata: { platform } })

    revalidatePath(`/produccion/idea/${ideaId}`)
    revalidatePath('/planning')
    return { ok: true, caption }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error al generar caption' }
  }
}

export async function saveIdeaCaption(
  ideaId: string,
  caption: string,
  platform?: string,
): Promise<{ ok?: true; error?: string }> {
  try {
    await requirePermission('captions.edit')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('content_ideas')
    .update({
      generated_caption: caption,
      caption_platform: platform ?? null,
      caption_generated_at: new Date().toISOString(),
    })
    .eq('id', ideaId)
  if (error) return { error: error.message }

  await logIdeaActivity(supabase, { ideaId, action: 'caption_saved', metadata: { platform: platform ?? null } })

  revalidatePath(`/produccion/idea/${ideaId}`)
  revalidatePath('/planning')
  return { ok: true }
}
