'use server'

import Anthropic from '@anthropic-ai/sdk'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { logIdeaActivity } from '@/lib/utils/idea-activity'
import { fetchClientStyleExamples } from '@/lib/integrations/metricool-style'
import { buildIdeaCaptionPrompt } from '@/lib/utils/idea-caption-prompt'
import { isIdeaReadyForCaption } from '@/lib/utils/idea-ready'
import { resolvePlatforms } from '@/lib/utils/idea-posting-core'

const CAPTION_MODEL = 'claude-sonnet-4-6'

/**
 * Generate a caption for a specific idea, grounded in the idea's hook +
 * caption_angle + suggested hashtags AND the client's brand voice.
 * Saves the result to content_ideas.generated_caption.
 */
export async function generateIdeaCaption(
  ideaId: string,
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
    .select('id, title, hook, visual_brief, caption_angle, hashtags_suggestion, content_type, client:clients(name, brand_voice, caption_language, default_cta, default_hashtags, caption_notes, metricool_blog_id, platforms, default_platforms)')
    .eq('id', ideaId)
    .single()

  if (!idea) return { error: 'Idea no encontrada' }

  if (!isIdeaReadyForCaption(idea)) {
    return { error: 'Completa el hook y el brief visual de la idea antes de generar el caption.' }
  }

  const client = (idea.client ?? {}) as {
    name?: string
    brand_voice?: string | null
    caption_language?: string | null
    default_cta?: string | null
    default_hashtags?: string | null
    caption_notes?: string | null
    metricool_blog_id?: string | null
    platforms?: string[] | null
    default_platforms?: string[] | null
  }

  // One caption for ALL the client's networks — generated for exactly the
  // platforms it will be published to (same resolution the publisher uses).
  const platforms = resolvePlatforms(client.platforms, client.default_platforms)

  // Pull the client's recently published captions from Metricool so the model
  // imitates their real style (best-effort — returns [] if unavailable).
  const examples = await fetchClientStyleExamples(client.metricool_blog_id ?? undefined)

  const prompt = buildIdeaCaptionPrompt({
    title: idea.title,
    hook: idea.hook,
    visualBrief: idea.visual_brief,
    captionAngle: idea.caption_angle,
    hashtags: idea.hashtags_suggestion,
    platforms,
    examples,
    client: {
      name: client.name,
      brandVoice: client.brand_voice,
      captionLanguage: client.caption_language,
      defaultCta: client.default_cta,
      captionNotes: client.caption_notes,
    },
  })

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
        caption_platform: null,
        caption_generated_at: new Date().toISOString(),
      })
      .eq('id', ideaId)
    if (updErr) return { error: updErr.message }

    await logIdeaActivity(supabase, { ideaId, action: 'caption_generated', metadata: { platforms, examplesUsed: examples.length } })

    revalidatePath(`/produccion/idea/${ideaId}`)
    revalidatePath('/planning')
    revalidatePath('/pipeline')
    return { ok: true, caption }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error al generar caption' }
  }
}

export async function saveIdeaCaption(
  ideaId: string,
  caption: string,
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
      caption_platform: null,
      caption_generated_at: new Date().toISOString(),
    })
    .eq('id', ideaId)
  if (error) return { error: error.message }

  await logIdeaActivity(supabase, { ideaId, action: 'caption_saved', metadata: {} })

  revalidatePath(`/produccion/idea/${ideaId}`)
  revalidatePath('/planning')
  return { ok: true }
}
