'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'

const CAPTION_MODEL = 'claude-sonnet-4-6'

/**
 * Generate a caption from just a title + client (no idea row needed, nothing
 * persisted). Powers the "✨ Generar con IA" button in the recorded-video
 * intake, where the idea doesn't exist yet. Grounded in the client's brand
 * voice, mirroring generateIdeaCaption. The caller saves the chosen caption
 * when the video is created.
 */
export async function generateCaptionDraft(input: {
  clientId: string
  title: string
  platform?: string
}): Promise<{ caption?: string; error?: string }> {
  try {
    await requirePermission('captions.use')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const title = (input.title ?? '').trim()
  if (!title) return { error: 'Escribe un título primero.' }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: 'ANTHROPIC_API_KEY no está configurado en el servidor.' }
  }

  const platform = input.platform ?? 'instagram'
  const supabase = await createClient()
  const { data: client } = await supabase
    .from('clients')
    .select('name, brand_voice, caption_language, default_cta, default_hashtags, caption_notes')
    .eq('id', input.clientId)
    .single()

  const c = (client ?? {}) as {
    name?: string
    brand_voice?: string | null
    caption_language?: string | null
    default_cta?: string | null
    default_hashtags?: string | null
    caption_notes?: string | null
  }

  const constraints = [
    c.caption_language && `Idioma: ${c.caption_language} (IMPORTANTE: escribe el caption en este idioma)`,
    c.brand_voice && `Voz de marca: ${c.brand_voice}`,
    c.default_cta && `CTA preferido: ${c.default_cta}`,
    c.default_hashtags && `Hashtags base: ${c.default_hashtags}`,
    c.caption_notes && `Reglas a seguir: ${c.caption_notes}`,
  ].filter(Boolean).join('\n')

  const prompt = `Eres un copywriter profesional de redes sociales para NMedia PR, agencia de marketing puertorriqueña.

CLIENTE: ${c.name ?? 'cliente'}
PLATAFORMA: ${platform}
TÍTULO DEL VIDEO: ${title}

${constraints ? `RESTRICCIONES:\n${constraints}\n` : ''}TAREA: Escribe UN caption completo para este video a partir del título.
- Engancha en la primera línea
- Incluye un CTA claro
- Termina con hashtags relevantes
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
    return { caption }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error al generar caption' }
  }
}
