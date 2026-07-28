'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'

/**
 * Data for the Copy stage: approved videos still missing their caption, plus
 * the client-level text that must appear in every caption.
 *
 * That "always include" text is `clients.caption_notes` — the same field the
 * caption prompt already reads as the client's rules (see idea-captions.ts), so
 * editing it here changes what the AI is told, not just what a human copies.
 */

export interface CopyVideoRow {
  id: string
  /** content_idea_videos.id of the edited file — signed for playback. */
  videoFileId: string | null
  title: string
  clientName: string
  hook: string | null
  visualBrief: string | null
  captionAngle: string | null
  hashtags: string | null
  generated_caption: string | null
  /** YYYY-MM-DD — the date the copywriter picked, if any. */
  publishDate: string | null
  platforms: string[]
}

export interface CopyStageData {
  videos: CopyVideoRow[]
  /** Text the client wants in every caption (schedule, address, disclaimers…). */
  captionNotes: string | null
}

export async function getEntregaCopyVideos(
  clientId: string,
): Promise<{ data?: CopyStageData; error?: string }> {
  try {
    await requirePermission('entregas.read')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()

  const [{ data: client }, { data: ideas, error }] = await Promise.all([
    supabase
      .from('clients')
      .select('name, caption_notes, platforms, default_platforms')
      .eq('id', clientId)
      .single(),
    supabase
      .from('content_ideas')
      .select('id, title, hook, visual_brief, caption_angle, hashtags_suggestion, generated_caption, publish_date, videos:content_idea_videos(id, kind, storage_provider, uploaded_at)')
      .eq('client_id', clientId)
      .eq('approval_status', 'approved')
      .order('approved_at', { ascending: true }),
  ])

  if (error) return { error: error.message }

  const platforms = (client?.platforms?.length ? client.platforms : client?.default_platforms) ?? []

  return {
    data: {
      captionNotes: client?.caption_notes ?? null,
      videos: (ideas ?? []).map((i) => {
        const files = (i.videos ?? []) as { id: string; kind: string; storage_provider: string; uploaded_at: string }[]
        // Newest edited file in R2 — a re-upload leaves the older row behind.
        const edited = files
          .filter((f) => f.kind === 'edited' && f.storage_provider === 'entregas-r2')
          .sort((a, b) => (a.uploaded_at < b.uploaded_at ? 1 : -1))[0]
        return {
        id: i.id,
        videoFileId: edited?.id ?? null,
        title: i.title ?? 'Sin título',
        clientName: client?.name ?? 'Cliente',
        hook: i.hook,
        visualBrief: i.visual_brief,
        captionAngle: i.caption_angle,
        hashtags: i.hashtags_suggestion,
        generated_caption: i.generated_caption,
        publishDate: (i.publish_date as string | null) ?? null,
        platforms: platforms as string[],
        }
      }),
    },
  }
}

/**
 * "De qué es el video" — the ONE field the caption AI requires
 * (isIdeaReadyForCaption). Editable here because the editor may have left it
 * blank at submit, and without it the generate button just refuses.
 */
export async function updateIdeaHook(
  ideaId: string,
  hook: string,
): Promise<{ ok?: true; error?: string }> {
  try {
    await requirePermission('captions.edit')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('content_ideas')
    .update({ hook: hook.trim() || null })
    .eq('id', ideaId)
  if (error) return { error: error.message }

  revalidatePath('/entregas')
  return { ok: true }
}

/**
 * Client-level text for every caption. Lives on the CLIENT, not the video: a
 * schedule or address doesn't change per post, and re-typing it each time is
 * how it ends up inconsistent.
 */
export async function saveClientCaptionNotes(
  clientId: string,
  notes: string,
): Promise<{ ok?: true; error?: string }> {
  try {
    await requirePermission('captions.edit')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('clients')
    .update({ caption_notes: notes.trim() || null })
    .eq('id', clientId)
  if (error) return { error: error.message }

  revalidatePath('/entregas')
  return { ok: true }
}

/**
 * Save the copy and the publish date in one write.
 *
 * They travel together on purpose: saving the caption is what moves the video
 * to Publicación, and a video that lands there without a date gets clamped to
 * +24h. Two separate calls would leave a window where the board shows a date
 * that isn't the one the copywriter just chose.
 */
export async function saveCopyAndSchedule(input: {
  ideaId: string
  caption: string
  /** YYYY-MM-DD, or null to let Metricool take +24h. */
  publishDate: string | null
}): Promise<{ ok?: true; error?: string }> {
  try {
    await requirePermission('captions.edit')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const caption = input.caption.trim()
  if (!caption) return { error: 'El copy no puede ir vacío' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('content_ideas')
    .update({
      generated_caption: caption,
      caption_generated_at: new Date().toISOString(),
      publish_date: input.publishDate || null,
    })
    .eq('id', input.ideaId)
  if (error) return { error: error.message }

  revalidatePath('/entregas')
  return { ok: true }
}
