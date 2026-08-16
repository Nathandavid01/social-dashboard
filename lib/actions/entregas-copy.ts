'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission, currentUserHas } from '@/lib/auth/server'
import { maybeAutoPostIdea, type AutoPostOutcome } from '@/lib/actions/idea-posting'

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
  /** The caption a human saved. Non-empty = the video already left Copy. */
  generated_caption: string | null
  /** Unreviewed AI text. Loaded back into the box so a reload doesn't lose it. */
  caption_draft: string | null
  /** YYYY-MM-DD — the date the copywriter picked, if any. */
  publishDate: string | null
  platforms: string[]
  /** 'ai' cuando este hook lo escribió el análisis de video (v3.40). Siempre
   *  null si la migración 0064 no está aplicada (se lee en un SELECT aparte,
   *  best-effort — nunca tumba el resto de la respuesta). */
  hookSource: 'ai' | null
}

export interface CopyStageData {
  videos: CopyVideoRow[]
  /** Text the client wants in every caption (schedule, address, disclaimers…). */
  captionNotes: string | null
}

export async function getEntregaCopyVideos(
  clientId: string,
  ideaId?: string,
): Promise<{ data?: CopyStageData; error?: string }> {
  // Cualquiera de las dos pantallas del flujo: el editor vive en /revision y
  // el copy en /entregas, pero ambos necesitan mirar el mismo video.
  if (!(await currentUserHas('revision.read')) && !(await currentUserHas('entregas.read'))) {
    return { error: 'No autorizado' }
  }

  const supabase = await createClient()

  const [{ data: client }, { data: ideas, error }] = await Promise.all([
    supabase
      .from('clients')
      .select('name, caption_notes, platforms, default_platforms')
      .eq('id', clientId)
      .single(),
    (() => {
      let q = supabase
        .from('content_ideas')
        .select('id, title, hook, visual_brief, caption_angle, hashtags_suggestion, generated_caption, caption_draft, publish_date, videos:content_idea_videos!content_idea_videos_idea_id_fkey(id, kind, storage_provider, uploaded_at)')
        .eq('client_id', clientId)
        .eq('approval_status', 'approved')
      if (ideaId) q = q.eq('id', ideaId)
      return q.order('approved_at', { ascending: true })
    })(),
  ])

  if (error) return { error: error.message }

  const platforms = (client?.platforms?.length ? client.platforms : client?.default_platforms) ?? []

  // hook_source vive en un SELECT aparte del crítico de arriba: si la
  // migración 0064 no está aplicada, este select falla solo y cada video
  // queda con hookSource: null — nunca tumba el resto del overlay.
  const hookSources: Record<string, 'ai' | null> = {}
  try {
    const ids = (ideas ?? []).map((i) => i.id)
    if (ids.length > 0) {
      const { data: hsRows, error: hsError } = await supabase
        .from('content_ideas')
        .select('id, hook_source')
        .in('id', ids)
      if (!hsError) {
        for (const row of (hsRows ?? []) as { id: string; hook_source?: string | null }[]) {
          hookSources[row.id] = row.hook_source === 'ai' ? 'ai' : null
        }
      }
    }
  } catch {
    // Columna sin migrar todavía: todos quedan sin marca.
  }

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
        caption_draft: (i as { caption_draft?: string | null }).caption_draft ?? null,
        publishDate: (i.publish_date as string | null) ?? null,
        platforms: platforms as string[],
        hookSource: hookSources[i.id] ?? null,
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
  const trimmed = hook.trim() || null

  // CopyOverlay llama esto en CADA click de "Generar", no solo cuando el
  // copywriter editó el campo a mano — comparar contra lo ya guardado evita
  // pisar la marca "escrito por la IA" (hook_source) cuando en realidad nada
  // cambió. Si no hay nada que cambiar, tampoco hay nada que escribir.
  const { data: existing } = await supabase.from('content_ideas').select('hook').eq('id', ideaId).maybeSingle()
  const changed = !existing || (existing as { hook?: string | null }).hook !== trimmed
  if (!changed) return { ok: true }

  const { error } = await supabase
    .from('content_ideas')
    .update({ hook: trimmed })
    .eq('id', ideaId)
  if (error) return { error: error.message }

  // Update separado y best-effort: si la migración 0064 (hook_source) no está
  // aplicada, el hook ya quedó guardado arriba.
  try {
    await supabase.from('content_ideas').update({ hook_source: null }).eq('id', ideaId)
  } catch {
    // Columna sin migrar todavía: degrada seguro.
  }

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
 *
 * This is the ONLY path out of Copy. Generating with the AI leaves its text in
 * `caption_draft`, which the board ignores — the copywriter has to look at it
 * and press the button before the video moves.
 */
export async function saveCopyAndSchedule(input: {
  ideaId: string
  caption: string
  /** YYYY-MM-DD, or null to let Metricool take +24h. */
  publishDate: string | null
  /** Edited file the copywriter previewed — Metricool must send that one. */
  videoFileId?: string | null
}): Promise<{ ok?: true; error?: string; autopost?: AutoPostOutcome }> {
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
      // El borrador ya cumplió: promovido, se limpia. Dejarlo haría que una
      // recarga reviviera el texto de la IA encima del copy aprobado.
      caption_draft: null,
      caption_generated_at: new Date().toISOString(),
      publish_date: input.publishDate || null,
    })
    .eq('id', input.ideaId)
  if (error) return { error: error.message }

  revalidatePath('/entregas')
  // Copy is what made the idea ready (caption + already-approved video).
  // maybeAutoPostIdea no-ops unless caption + edited video + Metricool.
  const autopost = await maybeAutoPostIdea(input.ideaId, {
    videoFileId: input.videoFileId,
    watchedOn: 'entregas',
  })
  return { ok: true, autopost }
}
