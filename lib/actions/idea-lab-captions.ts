'use server'

<<<<<<< Updated upstream
=======
import Anthropic from '@anthropic-ai/sdk'
>>>>>>> Stashed changes
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { createDraftPost } from '@/lib/metricool/post'
import { fetchClientStyleExamples } from '@/lib/integrations/metricool-style'
<<<<<<< Updated upstream
import { fetchApprovedCaptionExamples, fetchCaptionFeedbackForPrompt } from '@/lib/integrations/caption-learning'
import { mergeApprovedAndLoved } from '@/lib/utils/caption-learning'
import { buildIdeaCaptionPrompt } from '@/lib/utils/idea-caption-prompt'
import { resolvePlatforms } from '@/lib/utils/idea-posting-core'
import { approvedIdeaSendReadiness, autopublishTimeError, buildScheduledDateTime, quickSendMediaOptions, scheduleDateError } from '@/lib/utils/idea-lab-send-core'
import { generateCaptionText, captionConfigError } from '@/lib/llm/caption-llm'
=======
import { buildIdeaCaptionPrompt } from '@/lib/utils/idea-caption-prompt'
import { resolvePlatforms } from '@/lib/utils/idea-posting-core'
import { approvedIdeaSendReadiness, buildScheduledDateTime } from '@/lib/utils/idea-lab-send-core'

const CAPTION_MODEL = 'claude-sonnet-4-6'
>>>>>>> Stashed changes

/** Shape of the client fields we read for caption voice + Metricool routing. */
type FeedbackClient = {
  name?: string | null
  brand_voice?: string | null
  caption_language?: string | null
  default_cta?: string | null
  caption_notes?: string | null
  metricool_blog_id?: string | null
  platforms?: string[] | null
  default_platforms?: string[] | null
}

/**
 * Generate a caption for an APPROVED idea (idea_lab_feedback row), grounded in
 * the idea's hook + caption_angle + suggested hashtags AND the client's brand
 * voice and real published style (pulled from Metricool). Saves the result to
 * idea_lab_feedback.generated_caption.
 *
 * This is the Idea-Lab twin of generateIdeaCaption (which works on
 * content_ideas); approved ideas live in a different table so they need their
 * own action.
 */
export async function generateApprovedIdeaCaption(
  feedbackId: string,
<<<<<<< Updated upstream
  _platform?: string,
=======
  platform = 'instagram',
>>>>>>> Stashed changes
): Promise<{ ok?: true; caption?: string; error?: string }> {
  try {
    await requirePermission('captions.use')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

<<<<<<< Updated upstream
  const configError = captionConfigError(process.env)
  if (configError) return { error: configError }
=======
  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: 'ANTHROPIC_API_KEY no está configurado en el servidor.' }
  }
>>>>>>> Stashed changes

  const supabase = await createClient()
  const { data: idea } = await supabase
    .from('idea_lab_feedback')
    .select(
<<<<<<< Updated upstream
      'id, client_id, title, hook, caption_angle, hashtags_suggestion, content_type, client:clients!idea_lab_feedback_client_id_fkey(name, brand_voice, caption_language, default_cta, caption_notes, metricool_blog_id, platforms, default_platforms)',
=======
      'id, title, hook, caption_angle, hashtags_suggestion, content_type, client:clients!idea_lab_feedback_client_id_fkey(name, brand_voice, caption_language, default_cta, caption_notes, metricool_blog_id)',
>>>>>>> Stashed changes
    )
    .eq('id', feedbackId)
    .single()

  if (!idea) return { error: 'Idea no encontrada' }

  const client = (idea.client ?? {}) as FeedbackClient

<<<<<<< Updated upstream
  // Learning loop (best-effort, parallel): Metricool style + approved captions + 👍/👎 ratings.
  const clientId = (idea as { client_id?: string | null }).client_id
  const [examples, approved, ratings] = await Promise.all([
    fetchClientStyleExamples(client.metricool_blog_id ?? undefined),
    fetchApprovedCaptionExamples(supabase, clientId, { excludeId: feedbackId }),
    fetchCaptionFeedbackForPrompt(supabase, clientId),
  ])
  const approvedExamples = mergeApprovedAndLoved(ratings.loved, approved)
  const platforms = resolvePlatforms(client.platforms, client.default_platforms)
=======
  // Pull the client's recently published captions from Metricool so the model
  // imitates their real style (best-effort — returns [] if unavailable).
  const examples = await fetchClientStyleExamples(client.metricool_blog_id ?? undefined)
>>>>>>> Stashed changes

  const prompt = buildIdeaCaptionPrompt({
    title: idea.title,
    hook: idea.hook,
    captionAngle: idea.caption_angle,
    hashtags: idea.hashtags_suggestion,
<<<<<<< Updated upstream
    platforms,
    examples,
    approvedExamples,
    avoidExamples: ratings.avoid,
=======
    platform,
    examples,
>>>>>>> Stashed changes
    client: {
      name: client.name,
      brandVoice: client.brand_voice,
      captionLanguage: client.caption_language,
      defaultCta: client.default_cta,
      captionNotes: client.caption_notes,
    },
  })

  try {
<<<<<<< Updated upstream
    const caption = await generateCaptionText(prompt)
=======
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
>>>>>>> Stashed changes

    if (!caption) return { error: 'La IA no devolvió caption' }

    const { error: updErr } = await supabase
      .from('idea_lab_feedback')
      .update({
        generated_caption: caption,
<<<<<<< Updated upstream
        caption_platform: null,
=======
        caption_platform: platform,
>>>>>>> Stashed changes
        caption_generated_at: new Date().toISOString(),
      })
      .eq('id', feedbackId)
    if (updErr) return { error: updErr.message }

    revalidatePath('/ideas-aprobadas')
    return { ok: true, caption }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error al generar caption' }
  }
}

/** Manually edit + save an approved idea's caption (no AI). */
export async function saveApprovedIdeaCaption(
  feedbackId: string,
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
    .from('idea_lab_feedback')
    .update({
      generated_caption: caption,
      caption_platform: platform ?? null,
      caption_generated_at: new Date().toISOString(),
    })
    .eq('id', feedbackId)
  if (error) return { error: error.message }

  revalidatePath('/ideas-aprobadas')
  return { ok: true }
}

/**
 * Send an approved idea to Metricool as a scheduled DRAFT for the chosen date.
 * Deliberately a draft (draft:true / no autoPublish): these ideas have no
 * attached video yet, so the team finalizes the media and approves it inside
 * Metricool before it goes live. Idempotent: refuses if already sent.
 */
export async function sendApprovedIdeaToMetricool(
  feedbackId: string,
  schedule: { date: string; time?: string | null },
): Promise<{ ok?: true; error?: string; scheduledFor?: string }> {
  try {
    await requirePermission('posting.publish')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

<<<<<<< Updated upstream
  const dateErr = scheduleDateError(schedule.date)
  if (dateErr) return { error: dateErr }
=======
>>>>>>> Stashed changes
  const scheduledFor = buildScheduledDateTime(schedule.date, schedule.time)
  if (!scheduledFor) return { error: 'Elige una fecha válida para programar.' }

  const supabase = await createClient()
  const { data: idea } = await supabase
    .from('idea_lab_feedback')
    .select(
      'id, content_type, generated_caption, metricool_post_id, client:clients!idea_lab_feedback_client_id_fkey(metricool_blog_id, platforms, default_platforms)',
    )
    .eq('id', feedbackId)
    .single()
  if (!idea) return { error: 'Idea no encontrada' }

  const client = (idea.client ?? {}) as FeedbackClient
  const blogId = client.metricool_blog_id?.trim()

  const readiness = approvedIdeaSendReadiness(
    {
      generated_caption: idea.generated_caption as string | null,
      metricool_post_id: (idea.metricool_post_id as number | null) ?? null,
    },
    blogId,
  )
  if (!readiness.ready) return { error: readiness.reason }

  const platforms = resolvePlatforms(client.platforms, client.default_platforms)

  try {
    const res = await createDraftPost(
      idea.generated_caption as string,
      blogId,
      platforms,
      undefined,
      scheduledFor,
      // autoPublish omitted => draft:true. The post lands in the Metricool
      // calendar on the chosen date for the team to finalize and approve.
      { contentType: (idea.content_type as string | null) ?? null },
    )
    const postId = res.data?.id ?? null
    const uuid = res.data?.uuid ?? null

    const { error: updErr } = await supabase
      .from('idea_lab_feedback')
      .update({
        metricool_post_id: postId,
        metricool_uuid: uuid,
        metricool_scheduled_for: scheduledFor,
        metricool_sent_at: new Date().toISOString(),
        metricool_error: null,
      })
      .eq('id', feedbackId)
    if (updErr) return { error: updErr.message }

    revalidatePath('/ideas-aprobadas')
    return { ok: true, scheduledFor }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al enviar a Metricool'
    await supabase.from('idea_lab_feedback').update({ metricool_error: msg }).eq('id', feedbackId)
    return { error: msg }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Quick / emergency caption — standalone, NOT tied to an approved idea. For
// last-minute posts: pick a client, describe the topic, generate (or write) a
// caption, send to Metricool as a scheduled draft. Nothing is persisted in our
// DB — Metricool itself is the record. Same AI engine + client voice as above.
// ───────────────────────────────────────────────────────────────────────────

/** Generate a caption from a free-text topic for a client (no DB write). */
export async function generateQuickCaption(input: {
  clientId: string
  topic: string
  platform?: string
}): Promise<{ ok?: true; caption?: string; error?: string }> {
  try {
    await requirePermission('captions.use')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

<<<<<<< Updated upstream
  const configError = captionConfigError(process.env)
  if (configError) return { error: configError }
=======
  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: 'ANTHROPIC_API_KEY no está configurado en el servidor.' }
  }
>>>>>>> Stashed changes
  if (!input.clientId) return { error: 'Elige un cliente.' }
  if (!input.topic || input.topic.trim().length === 0) {
    return { error: 'Escribe de qué trata el caption.' }
  }

<<<<<<< Updated upstream
  const supabase = await createClient()
  const { data: client } = await supabase
    .from('clients')
    .select('name, brand_voice, caption_language, default_cta, caption_notes, metricool_blog_id, platforms, default_platforms')
=======
  const platform = input.platform ?? 'instagram'
  const supabase = await createClient()
  const { data: client } = await supabase
    .from('clients')
    .select('name, brand_voice, caption_language, default_cta, caption_notes, metricool_blog_id')
>>>>>>> Stashed changes
    .eq('id', input.clientId)
    .single()
  if (!client) return { error: 'Cliente no encontrado' }

  const c = client as FeedbackClient
  const examples = await fetchClientStyleExamples(c.metricool_blog_id ?? undefined)
<<<<<<< Updated upstream
  const platforms = resolvePlatforms(c.platforms, c.default_platforms)
=======
>>>>>>> Stashed changes

  const prompt = buildIdeaCaptionPrompt({
    title: input.topic.trim(),
    hook: null,
    captionAngle: null,
    hashtags: null,
<<<<<<< Updated upstream
    platforms,
=======
    platform,
>>>>>>> Stashed changes
    examples,
    client: {
      name: c.name,
      brandVoice: c.brand_voice,
      captionLanguage: c.caption_language,
      defaultCta: c.default_cta,
      captionNotes: c.caption_notes,
    },
  })

  try {
<<<<<<< Updated upstream
    const caption = await generateCaptionText(prompt)
=======
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
>>>>>>> Stashed changes
    if (!caption) return { error: 'La IA no devolvió caption' }
    return { ok: true, caption }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error al generar caption' }
  }
}

<<<<<<< Updated upstream
/**
 * Send a standalone caption to Metricool (no DB write). With a video (`mediaUrl`,
 * a permanent public URL) it attaches the media and AUTO-PUBLISHES a real
 * scheduled post; without a video it stays a scheduled draft. Posts to the
 * client's configured platforms (the same caption for all of them).
 */
=======
/** Send a standalone caption to Metricool as a scheduled draft (no DB write). */
>>>>>>> Stashed changes
export async function sendQuickCaptionToMetricool(input: {
  clientId: string
  caption: string
  date: string
  time?: string | null
<<<<<<< Updated upstream
  contentType?: string | null
  /** Permanent public URL of an uploaded video (from getQuickUploadUrl). */
  mediaUrl?: string | null
  /** true = auto-publish a real scheduled post; false/omitted = scheduled draft. */
  autoPublish?: boolean
}): Promise<{ ok?: true; error?: string; scheduledFor?: string; autoPublished?: boolean }> {
=======
  platform?: string
  contentType?: string | null
}): Promise<{ ok?: true; error?: string; scheduledFor?: string }> {
>>>>>>> Stashed changes
  try {
    await requirePermission('posting.publish')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  if (!input.clientId) return { error: 'Elige un cliente.' }
<<<<<<< Updated upstream
  const dateErr = scheduleDateError(input.date)
  if (dateErr) return { error: dateErr }
  const scheduledFor = buildScheduledDateTime(input.date, input.time)
  if (!scheduledFor) return { error: 'Elige una fecha válida para programar.' }
  // Auto-publish must be in the future (a past datetime publishes immediately /
  // errors). Drafts are exempt — a past-dated draft is harmless.
  const timeErr = autopublishTimeError(scheduledFor, !!input.autoPublish)
  if (timeErr) return { error: timeErr }
=======
  const scheduledFor = buildScheduledDateTime(input.date, input.time)
  if (!scheduledFor) return { error: 'Elige una fecha válida para programar.' }
>>>>>>> Stashed changes

  const supabase = await createClient()
  const { data: client } = await supabase
    .from('clients')
    .select('metricool_blog_id, platforms, default_platforms')
    .eq('id', input.clientId)
    .single()
  if (!client) return { error: 'Cliente no encontrado' }

  const c = client as FeedbackClient
  const blogId = c.metricool_blog_id?.trim()

  // Reuse the readiness gate (caption present + client has a Metricool blog id).
  const readiness = approvedIdeaSendReadiness(
    { generated_caption: input.caption, metricool_post_id: null },
    blogId,
  )
  if (!readiness.ready) return { error: readiness.reason }

  const platforms = resolvePlatforms(c.platforms, c.default_platforms)
<<<<<<< Updated upstream
  const media = quickSendMediaOptions(input.mediaUrl, input.autoPublish)
=======
>>>>>>> Stashed changes

  try {
    await createDraftPost(
      input.caption,
      blogId,
      platforms,
      undefined,
      scheduledFor,
<<<<<<< Updated upstream
      { ...media, contentType: input.contentType ?? null },
    )
    return { ok: true, scheduledFor, autoPublished: media.autoPublish }
=======
      { contentType: input.contentType ?? null },
    )
    return { ok: true, scheduledFor }
>>>>>>> Stashed changes
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error al enviar a Metricool' }
  }
}
