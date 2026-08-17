'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { logIdeaActivity } from '@/lib/utils/idea-activity'
import { fetchClientStyleExamples } from '@/lib/integrations/metricool-style'
import { fetchApprovedCaptionExamples, fetchCaptionFeedbackForPrompt } from '@/lib/integrations/caption-learning'
import { fetchCaptionCorrectionsForPrompt } from '@/lib/integrations/caption-corrections'
import { mergeApprovedAndLoved } from '@/lib/utils/caption-learning'
import { huboCambioSignificativo } from '@/lib/utils/caption-corrections'
import { nombrarAngulo, sonDemasiadoParecidos } from '@/lib/utils/caption-angles'
import { buildIdeaCaptionPrompt, type IdeaCaptionPromptInput } from '@/lib/utils/idea-caption-prompt'
import { hasCaptionableVideo, isIdeaReadyForCaption } from '@/lib/utils/idea-ready'
import { resolvePlatforms } from '@/lib/utils/idea-posting-core'
import { generateCaptionText, captionConfigError } from '@/lib/llm/caption-llm'
import { transcribeVideoFromUrl } from '@/lib/integrations/whisper'
import { listenUrlForCaptionVideo } from '@/lib/integrations/caption-listen-url'
import { pickCaptionSourceVideo } from '@/lib/utils/video-caption-source'
import { displayCaptionDraft } from '@/lib/utils/caption-draft'
import type { SupabaseClient } from '@supabase/supabase-js'

const filled = (s?: string | null): boolean => !!s && s.trim().length > 0

/**
 * Heurística honesta (ver lib/utils/caption-angles.ts) para mostrarle al
 * modelo, en un renglón corto, en qué se diferencia el caption de un hermano
 * — NO es una clasificación inteligente del contenido.
 */
function describirAngulo(caption: string): string {
  const { primeraLinea, tipoCta } = nombrarAngulo(caption)
  const snippet = primeraLinea.length > 60 ? `${primeraLinea.slice(0, 60)}…` : primeraLinea
  return tipoCta !== 'otro' ? `${snippet} — CTA: ${tipoCta}` : snippet
}

/**
 * Pieza 1: los demás videos de la MISMA idea/lote (mismo cliente, activos, no
 * publicados) que ya tienen un caption — para que el generador no los repita.
 * Best-effort: cualquier error de Supabase degrada a "sin hermanos", nunca
 * bloquea la generación.
 */
async function fetchSiblingCaptions(
  supabase: SupabaseClient,
  clientId: string | null | undefined,
  ideaId: string,
): Promise<{ titulo: string; caption: string }[]> {
  if (!clientId) return []
  try {
    const { data } = await supabase
      .from('content_ideas')
      .select('id, title, caption_draft, generated_caption, status, published_at')
      .eq('client_id', clientId)
      .neq('id', ideaId)
      .order('created_at', { ascending: false })
      .limit(20)

    const rows = (data ?? []) as {
      title: string | null
      caption_draft: string | null
      generated_caption: string | null
      status: string | null
      published_at: string | null
    }[]

    return rows
      .filter((r) => r.status !== 'descartada' && !r.published_at)
      .map((r) => ({
        titulo: r.title ?? '',
        caption: displayCaptionDraft(r.generated_caption || r.caption_draft),
      }))
      .filter((h) => filled(h.caption))
      .slice(0, 8)
  } catch {
    return []
  }
}

/**
 * Generate a caption for a specific idea, grounded in the idea's hook +
 * caption_angle + suggested hashtags AND the client's brand voice.
 *
 * Saves the result to `content_ideas.caption_draft` — a DRAFT, deliberately not
 * `generated_caption`. `ideaStage()` sends any approved video with a non-empty
 * `generated_caption` to Publicación, so writing that field here meant pressing
 * "Generar con IA" shipped the video out of Copy with nobody having read,
 * edited or approved the text. Only `saveIdeaCaption` promotes the draft.
 */
export async function generateIdeaCaption(
  ideaId: string,
  /** Optional feedback to revise a prior attempt — the user's instructions
   *  ("más corto", "menos emojis") + the caption being revised.
   *  `auto` = opened the idea; never overwrite a draft the team already has. */
  opts?: {
    feedback?: string | null
    previousCaption?: string | null
    auto?: boolean
    /**
     * Captions de los OTROS videos de este lote, YA acumulados por el que
     * llama (ver batch-captions-button.tsx: genera en secuencia y pasa los
     * N-1 anteriores al video N). Si se omite (no la clave, undefined),
     * generateIdeaCaption busca por su cuenta los hermanos en la DB — así
     * regenerar un caption suelto también evita chocar con sus hermanos.
     * Pasar `[]` explícito (primer video del lote) SÍ cuenta como "ya sé
     * cuáles son los hermanos: ninguno" y NO dispara el auto-fetch.
     */
    hermanos?: { titulo: string; caption: string }[]
  },
): Promise<{ ok?: true; caption?: string; error?: string }> {
  try {
    await requirePermission('captions.use')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const configError = captionConfigError(process.env)
  if (configError) return { error: configError }

  const supabase = await createClient()
  const { data: idea } = await supabase
    .from('content_ideas')
    .select('id, client_id, title, hook, visual_brief, caption_angle, hashtags_suggestion, content_type, caption_draft, generated_caption, client:clients(name, brand_voice, caption_language, default_cta, default_hashtags, caption_notes, metricool_blog_id, platforms, default_platforms)')
    .eq('id', ideaId)
    .single()

  if (!idea) return { error: 'Idea no encontrada' }

  // Auto-draft on open: return what is already there. Manual "Regenerar" still overwrites.
  if (opts?.auto) {
    const existing = [idea.caption_draft, idea.generated_caption]
      .find((s) => typeof s === 'string' && s.trim().length > 0)
    if (existing) return { ok: true, caption: displayCaptionDraft(existing) }
  }

  const { data: vids } = await supabase
    .from('content_idea_videos')
    .select('id, kind, status, drive_file_id, storage_provider')
    .eq('idea_id', ideaId)
    .neq('status', 'archived')
  const hasVideo = hasCaptionableVideo(vids)
  if (!hasVideo) return { error: 'Sube un video antes de generar el caption.' }

  // QC IA: el análisis visual más reciente de un video editado de esta idea.
  // Best-effort — sin tabla (migración pendiente) o sin fila, el caption sale igual.
  // Leído ANTES del check de "listo": si la IA ya vio el video, el hook
  // ("¿De qué es este video?") deja de ser obligatorio (decisión de Eric).
  const { data: analysis } = await supabase
    .from('content_idea_video_analysis')
    .select('findings, visual_summary, status')
    .eq('idea_id', ideaId)
    .eq('status', 'done')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
    .then((r) => r, () => ({ data: null }))

  const hasVisualAnalysis = !!analysis?.visual_summary
  const source = pickCaptionSourceVideo((vids ?? []) as Parameters<typeof pickCaptionSourceVideo>[0])
  const videoUrl = await listenUrlForCaptionVideo(source)
  const videoTranscript = videoUrl ? await transcribeVideoFromUrl(videoUrl) : null

  if (!isIdeaReadyForCaption({ hook: idea.hook, hasVideo, hasVisualAnalysis })) {
    return { error: 'Di de qué es el video para generar el caption.' }
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

  // Same networks the publisher will use. ONE caption for all of them.
  const platforms = resolvePlatforms(client.platforms, client.default_platforms)

  // Learning loop (best-effort, all parallel): Metricool real style + the team's
  // APPROVED captions + explicit 👍/👎 ratings for this client.
  const clientId = (idea as { client_id?: string | null }).client_id
  const [examples, approved, ratings, teamCorrections, autoHermanos] = await Promise.all([
    fetchClientStyleExamples(client.metricool_blog_id ?? undefined),
    fetchApprovedCaptionExamples(supabase, clientId, { excludeId: idea.id }),
    fetchCaptionFeedbackForPrompt(supabase, clientId),
    fetchCaptionCorrectionsForPrompt(supabase, clientId),
    // Skip the query entirely when the caller already tells us the siblings
    // (batch button, mid-sequence) — [] is a valid "no siblings yet" answer.
    opts?.hermanos !== undefined ? Promise.resolve([]) : fetchSiblingCaptions(supabase, clientId, ideaId),
  ])
  // 👍-rated captions are the strongest positive signal → lead the approved list.
  const approvedExamples = mergeApprovedAndLoved(ratings.loved, approved)

  const hermanosRaw = opts?.hermanos !== undefined ? opts.hermanos : autoHermanos
  const hermanos = hermanosRaw
    .filter((h) => filled(h.caption))
    .map((h) => ({ ...h, angulo: describirAngulo(h.caption) }))

  const sharedPrompt: IdeaCaptionPromptInput = {
    title: idea.title as string,
    hook: idea.hook,
    visualBrief: idea.visual_brief,
    captionAngle: idea.caption_angle,
    hashtags: idea.hashtags_suggestion,
    platforms,
    examples,
    approvedExamples,
    avoidExamples: ratings.avoid,
    hermanos,
    teamCorrections,
    feedback: opts?.feedback ?? null,
    previousCaption: opts?.previousCaption ?? null,
    videoTranscript,
    videoAnalysis: analysis
      ? {
          visualSummary: analysis.visual_summary,
          burnedCaptionsText:
            (analysis.findings as { burned_captions?: { text?: string } } | null)?.burned_captions?.text ?? null,
        }
      : null,
    client: {
      name: client.name,
      brandVoice: client.brand_voice,
      captionLanguage: client.caption_language,
      defaultCta: client.default_cta,
      captionNotes: client.caption_notes,
    },
  }

  try {
    const caption = await generateCaptionText(buildIdeaCaptionPrompt(sharedPrompt))
    if (!caption?.trim()) return { error: 'La IA no devolvió caption' }
    let stored = caption.trim()

    // Pieza 2, red de seguridad: si el caption choca obviamente con un
    // hermano del lote (mismo gancho, mismo CTA + hashtags solapados),
    // regenera UNA sola vez con la instrucción reforzada. Si vuelve a
    // chocar se acepta igual — nunca bucles, nunca gasto infinito de API.
    let anguloChocado = hermanos.some((h) => sonDemasiadoParecidos(stored, h.caption))
    let regenerado = false
    if (anguloChocado) {
      regenerado = true
      const retry = await generateCaptionText(
        buildIdeaCaptionPrompt({ ...sharedPrompt, forceDistinctAngle: true }),
      )
      if (retry?.trim()) {
        stored = retry.trim()
        anguloChocado = hermanos.some((h) => sonDemasiadoParecidos(stored, h.caption))
      }
    }

    // Draft only. The stage-driving field stays untouched until a human saves.
    const { error: updErr } = await supabase
      .from('content_ideas')
      .update({ caption_draft: stored })
      .eq('id', ideaId)
    if (updErr) return { error: updErr.message }

    // Persist the feedback text too (not just a bool) so a future per-client
    // learning loop can mine recurring instructions ("siempre menos emojis").
    await logIdeaActivity(supabase, {
      ideaId,
      action: 'caption_generated',
      metadata: {
        platforms,
        examplesUsed: examples.length,
        revised: !!opts?.feedback,
        feedback: opts?.feedback?.trim() || null,
        hermanos: hermanos.length,
        regenerado,
        // true = tras la única regeneración, el caption todavía se parecía a
        // un hermano — se dejó igual, esto es la constancia en el log.
        anguloChocado,
      },
    })

    revalidatePath(`/produccion/idea/${ideaId}`)
    revalidatePath('/planning')
    revalidatePath('/pipeline')
    return { ok: true, caption: stored }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error al generar caption' }
  }
}

/**
 * Promote the caption a human settled on: it becomes `generated_caption` (the
 * field the pipeline reads) and the draft is cleared so no stale AI text is
 * left behind to reappear later.
 *
 * This — not generation — is what moves an approved video to Publicación.
 */
export async function saveIdeaCaption(
  ideaId: string,
  caption: string,
): Promise<{ ok?: true; error?: string }> {
  try {
    await requirePermission('captions.edit')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  // An empty save would clear `generated_caption` and silently drag the video
  // back from Publicación to Copy — refuse instead.
  const clean = caption.trim()
  if (!clean) return { error: 'El caption no puede ir vacío' }

  const supabase = await createClient()
  const { data: vids } = await supabase
    .from('content_idea_videos')
    .select('id, status')
    .eq('idea_id', ideaId)
    .neq('status', 'archived')
    .limit(1)
  if (!hasCaptionableVideo(vids)) {
    return { error: 'Sube un video antes de guardar el caption.' }
  }

  // Pieza 3: aprendizaje por corrección, POR CLIENTE — si hay un borrador y el
  // equipo lo cambió de verdad antes de guardar, esa diferencia es la señal
  // más valiosa que hay. Best-effort y ANTES de limpiar caption_draft abajo,
  // porque una vez limpio el borrador original se pierde para siempre.
  // Degrada seguro sin la migración 0066 (tabla inexistente → catch, sigue).
  try {
    const { data: current } = await supabase
      .from('content_ideas')
      .select('client_id, caption_draft')
      .eq('id', ideaId)
      .single()
    const draft = displayCaptionDraft((current as { caption_draft?: string | null } | null)?.caption_draft)
    const clientIdForCorrection = (current as { client_id?: string | null } | null)?.client_id
    if (filled(draft) && clientIdForCorrection && huboCambioSignificativo(draft, clean)) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      await supabase.from('caption_corrections').insert({
        client_id: clientIdForCorrection,
        idea_id: ideaId,
        draft_text: draft,
        final_text: clean,
        corrected_by: user?.id ?? null,
      })
    }
  } catch {
    // best-effort — never block saving the caption over this
  }

  const { error } = await supabase
    .from('content_ideas')
    .update({
      generated_caption: clean,
      caption_draft: null,
      caption_platform: null,
      caption_generated_at: new Date().toISOString(),
    })
    .eq('id', ideaId)
  if (error) return { error: error.message }

  await logIdeaActivity(supabase, { ideaId, action: 'caption_saved', metadata: {} })

  revalidatePath(`/produccion/idea/${ideaId}`)
  revalidatePath('/planning')
  revalidatePath('/pipeline')
  return { ok: true }
}
