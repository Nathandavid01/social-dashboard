'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { currentUserHas, getEffectiveUserId, requirePermission } from '@/lib/auth/server'
import { ideaTitleFromUpload } from '@/lib/pipeline/banco-direct-upload'
import type { IdeaApprovalStatus } from '@/lib/supabase/types'
import { generateIdeaCaption } from '@/lib/actions/idea-captions'
import { runIdeaPost } from '@/lib/actions/idea-posting-run'
import { generateCaptionText, captionConfigError } from '@/lib/llm/caption-llm'
import {
  PRIMER_ROUND_CLIENT_ID,
  PRIMER_ROUND_BLOG_ID,
  PRIMER_ROUND_IG_HANDLE,
  primerRoundAutopostEnabled,
} from '@/lib/primer-round/constants'
import { resolvePrimerRoundCollaborators, primerRoundCollabLabels } from '@/lib/primer-round/collabs'
import {
  overlayFromBurnedCaptions,
  captionSurfaceFromText,
  buildPrimerRoundOrthoGate,
  canAutoSchedulePrimerRound,
  buildDualOrthoPrompt,
  parseDualOrthoLlm,
  type PrimerRoundOrthoGate,
} from '@/lib/primer-round/orthography'
import { groupStudioIdeas, primerRoundCtas, type StudioIdeaRef } from '@/lib/primer-round/studio'
import type { VideoAnalysisFindings } from '@/lib/llm/video-analysis-core'

async function requirePrimerRoundAccess(): Promise<void> {
  const ok =
    (await currentUserHas('pipeline.read')) || (await currentUserHas('recording.read'))
  if (!ok) throw new Error('Acceso denegado (falta permiso: pipeline.read o recording.read)')
}

export type PrimerRoundStudioIdea = StudioIdeaRef & {
  caption: string | null
  contentType: string | null
  publishDate: string | null
  overlayText: string | null
  overlayIssues: number
  analysisStatus: 'pending' | 'done' | 'error' | null
}

export type PrimerRoundStudioPayload = {
  client: {
    id: string
    name: string
    logoUrl: string | null
    blogId: string
    igHandle: string
  }
  collabs: Array<{ username: string; label: string }>
  autopostEnabled: boolean
  ctas: ReturnType<typeof primerRoundCtas>
  lanes: ReturnType<typeof groupStudioIdeas<PrimerRoundStudioIdea>>
  ready: PrimerRoundStudioIdea[]
}

export async function getPrimerRoundStudio(): Promise<
  { studio?: PrimerRoundStudioPayload; error?: string }
> {
  try {
    await requirePrimerRoundAccess()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, name, logo_url, metricool_blog_id')
    .eq('id', PRIMER_ROUND_CLIENT_ID)
    .maybeSingle()

  if (clientErr || !client) {
    return { error: clientErr?.message ?? 'Cliente Primer Round no encontrado' }
  }

  const { data: ideasRaw, error: ideasErr } = await supabase
    .from('content_ideas')
    .select(
      'id, title, hook, status, approval_status, content_type, generated_caption, caption_draft, publish_date, metricool_post_id, videos:content_idea_videos!content_idea_videos_idea_id_fkey(id, kind, status)',
    )
    .eq('client_id', PRIMER_ROUND_CLIENT_ID)
    .neq('status', 'descartada')
    .order('updated_at', { ascending: false })
    .limit(120)

  if (ideasErr) return { error: ideasErr.message }

  const ideaIds = (ideasRaw ?? []).map((i) => i.id)
  const analysisByIdea = new Map<
    string,
    { status: 'pending' | 'done' | 'error'; findings: VideoAnalysisFindings | null }
  >()

  if (ideaIds.length > 0) {
    const { data: edited } = await supabase
      .from('content_idea_videos')
      .select('id, idea_id')
      .in('idea_id', ideaIds)
      .eq('kind', 'edited')
      .not('status', 'in', '(archived,failed)')

    const videoIds = (edited ?? []).map((v) => v.id)
    const videoToIdea = new Map((edited ?? []).map((v) => [v.id, v.idea_id as string]))

    if (videoIds.length > 0) {
      const { data: analyses } = await supabase
        .from('content_idea_video_analysis')
        .select('video_id, status, findings')
        .in('video_id', videoIds)

      for (const row of analyses ?? []) {
        const ideaId = videoToIdea.get(row.video_id as string)
        if (!ideaId) continue
        analysisByIdea.set(ideaId, {
          status: row.status as 'pending' | 'done' | 'error',
          findings: (row.findings as VideoAnalysisFindings | null) ?? null,
        })
      }
    }
  }

  const ideas: PrimerRoundStudioIdea[] = (ideasRaw ?? []).map((raw) => {
    const videos = (raw.videos ?? []) as Array<{ kind: string; status: string }>
    const live = videos.filter((v) => v.status !== 'archived' && v.status !== 'failed')
    const analysis = analysisByIdea.get(raw.id)
    const burned = analysis?.findings?.burned_captions
    const caption =
      ((raw.generated_caption as string | null) || (raw.caption_draft as string | null) || null)?.trim() ||
      null
    return {
      id: raw.id,
      title: (raw.title as string | null)?.trim() || (raw.hook as string | null)?.trim() || 'Sin título',
      status: raw.status as string | null,
      approval_status: raw.approval_status as string | null,
      metricool_post_id: (raw.metricool_post_id as number | null) ?? null,
      hasEditedVideo: live.some((v) => v.kind === 'edited'),
      hasRawVideo: live.some((v) => v.kind === 'raw' || v.kind === 'broll'),
      caption,
      contentType: (raw.content_type as string | null) ?? null,
      publishDate: (raw.publish_date as string | null) ?? null,
      overlayText: burned?.text?.trim() || null,
      overlayIssues: burned?.issues?.length ?? 0,
      analysisStatus: analysis?.status ?? null,
    }
  })

  const lanes = groupStudioIdeas(ideas)

  return {
    studio: {
      client: {
        id: client.id,
        name: client.name,
        logoUrl: client.logo_url,
        blogId: (client.metricool_blog_id as string | null)?.trim() || PRIMER_ROUND_BLOG_ID,
        igHandle: PRIMER_ROUND_IG_HANDLE,
      },
      collabs: primerRoundCollabLabels(),
      autopostEnabled: primerRoundAutopostEnabled(),
      ctas: primerRoundCtas(PRIMER_ROUND_CLIENT_ID),
      lanes,
      ready: lanes.ready,
    },
  }
}

/** CREATE: bottom IG caption only (reuses generateIdeaCaption → caption_draft). */
export async function generatePrimerRoundCaption(
  ideaId: string,
): Promise<{ ok?: true; caption?: string; error?: string }> {
  try {
    await requirePrimerRoundAccess()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()
  const { data: idea } = await supabase
    .from('content_ideas')
    .select('id, client_id')
    .eq('id', ideaId)
    .maybeSingle()
  if (!idea || idea.client_id !== PRIMER_ROUND_CLIENT_ID) {
    return { error: 'La idea no pertenece a Primer Round' }
  }

  return generateIdeaCaption(ideaId)
}

/** VERIFY: overlay (from video analysis) + bottom caption via LLM. */
export async function verifyPrimerRoundOrtho(
  ideaId: string,
): Promise<{ gate?: PrimerRoundOrthoGate; error?: string }> {
  try {
    await requirePrimerRoundAccess()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const cfgErr = captionConfigError(process.env)
  if (cfgErr) return { error: cfgErr }

  const supabase = await createClient()
  const { data: idea } = await supabase
    .from('content_ideas')
    .select('id, client_id, generated_caption, caption_draft')
    .eq('id', ideaId)
    .maybeSingle()
  if (!idea || idea.client_id !== PRIMER_ROUND_CLIENT_ID) {
    return { error: 'La idea no pertenece a Primer Round' }
  }

  const captionText =
    ((idea.generated_caption as string | null) || (idea.caption_draft as string | null) || '').trim()

  const { data: video } = await supabase
    .from('content_idea_videos')
    .select('id')
    .eq('idea_id', ideaId)
    .eq('kind', 'edited')
    .not('status', 'in', '(archived,failed)')
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let overlayText = ''
  let analysisIssues: Array<{ quote?: string; problem?: string; suggestion?: string; t?: string }> = []
  if (video) {
    const { data: analysis } = await supabase
      .from('content_idea_video_analysis')
      .select('findings, status')
      .eq('video_id', video.id)
      .maybeSingle()
    const findings = analysis?.findings as VideoAnalysisFindings | null
    if (findings?.burned_captions) {
      overlayText = findings.burned_captions.text ?? ''
      analysisIssues = findings.burned_captions.issues ?? []
    }
  }

  // Prefer analysis issues for overlay when present; still run dual LLM for caption.
  const prompt = buildDualOrthoPrompt(overlayText, captionText)
  try {
    const raw = await generateCaptionText(prompt, { maxTokens: 800 })
    let gate = parseDualOrthoLlm(raw, overlayText, captionText)
    // If analysis already flagged overlay typos, merge them in.
    if (analysisIssues.length > 0) {
      const fromAnalysis = overlayFromBurnedCaptions({ text: overlayText, issues: analysisIssues })
      gate = buildPrimerRoundOrthoGate({
        overlay: fromAnalysis.ok ? gate.overlay : fromAnalysis,
        caption: gate.caption.missing
          ? captionSurfaceFromText(captionText)
          : gate.caption,
      })
    }
    return { gate }
  } catch (err) {
    // Fallback: analysis-only overlay + caption presence
    const overlay = overlayFromBurnedCaptions({ text: overlayText, issues: analysisIssues })
    const caption = captionSurfaceFromText(captionText)
    return {
      gate: buildPrimerRoundOrthoGate({ overlay, caption }),
      error: err instanceof Error ? `IA parcial: ${err.message}` : undefined,
    }
  }
}

/**
 * Schedule Reel to Metricool with host collabs after dual verification passes
 * (or overrideOrtho=true).
 */
export async function schedulePrimerRoundReel(input: {
  ideaId: string
  overrideOrtho?: boolean
}): Promise<{ ok?: true; skipped?: string; error?: string; metricoolPostId?: number | null }> {
  try {
    await requirePrimerRoundAccess()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const collabs = resolvePrimerRoundCollaborators()
  if (collabs.length === 0) {
    return { error: 'Configura los handles de colaboración (PRIMER_ROUND_COLLAB_USERNAMES)' }
  }

  const verified = await verifyPrimerRoundOrtho(input.ideaId)
  if (!verified.gate && verified.error) return { error: verified.error }
  if (!verified.gate) return { error: 'No se pudo verificar ortografía' }

  const check = canAutoSchedulePrimerRound({
    gate: verified.gate,
    overrideOrtho: !!input.overrideOrtho,
    autopostEnabled: primerRoundAutopostEnabled(),
    collabsReady: collabs.length > 0,
  })
  if (!check.allowed) return { skipped: check.reason }

  // Promote draft → generated_caption if needed so runIdeaPost is ready.
  const supabase = await createClient()
  const { data: idea } = await supabase
    .from('content_ideas')
    .select('id, client_id, generated_caption, caption_draft, approval_status')
    .eq('id', input.ideaId)
    .maybeSingle()
  if (!idea || idea.client_id !== PRIMER_ROUND_CLIENT_ID) {
    return { error: 'La idea no pertenece a Primer Round' }
  }
  if (!(idea.generated_caption as string | null)?.trim() && (idea.caption_draft as string | null)?.trim()) {
    await supabase
      .from('content_ideas')
      .update({ generated_caption: idea.caption_draft })
      .eq('id', input.ideaId)
  }
  if (idea.approval_status !== 'approved') {
    return { skipped: 'La revisión debe estar aprobada antes de agendar' }
  }

  const userId = await getEffectiveUserId()
  // Primer Round path: runIdeaPost allows auto when client matches + kill switch off;
  // pass manualScheduling true from this explicit studio action so the team CTA always works.
  const result = await runIdeaPost(supabase, input.ideaId, userId, null, {
    manualScheduling: true,
    watchedOn: 'pipeline',
  })

  revalidatePath('/primer-round')
  revalidatePath('/pipeline')
  revalidatePath('/entregas')
  return result
}

/** Create a Primer Round idea row so the browser can attach an edited mp4/mov. */
export async function createPrimerRoundUploadIdea(input: {
  title?: string | null
  fileName?: string | null
}): Promise<{ ideaId?: string; title?: string; error?: string }> {
  try {
    await requirePrimerRoundAccess()
    await requirePermission('video.upload')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const title = ideaTitleFromUpload(input.title, [{ name: input.fileName ?? '' }])
  if (!title) return { error: 'Ponle un título al video (o sube un archivo con nombre)' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('content_ideas')
    .insert({
      client_id: PRIMER_ROUND_CLIENT_ID,
      content_type: 'R',
      title,
      status: 'producida',
      approval_status: 'submitted' satisfies IdeaApprovalStatus,
      submitted_at: new Date().toISOString(),
      created_by: user?.id ?? null,
    })
    .select('id, title')
    .single()

  if (error || !data) return { error: error?.message ?? 'No se pudo crear la idea' }

  revalidatePath('/primer-round')
  return { ideaId: data.id as string, title: (data.title as string) || title }
}

/**
 * One-shot AI pipeline after mp4/mov upload:
 * 1) caption IG (locked primerroundoficial template)
 * 2) approve for Metricool
 * 3) verify overlay + caption
 * 4) schedule Reel with collabs (unless ortho blocks and no override)
 */
export async function runPrimerRoundUploadPipeline(input: {
  ideaId: string
  videoId?: string | null
  overrideOrtho?: boolean
}): Promise<{
  ok?: true
  caption?: string | null
  gate?: PrimerRoundOrthoGate
  skipped?: string
  error?: string
  metricoolPostId?: number | null
}> {
  try {
    await requirePrimerRoundAccess()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const ideaId = input.ideaId?.trim()
  if (!ideaId) return { error: 'Falta la idea' }

  const supabase = await createClient()
  const { data: idea } = await supabase
    .from('content_ideas')
    .select('id, client_id, approval_status')
    .eq('id', ideaId)
    .maybeSingle()
  if (!idea || idea.client_id !== PRIMER_ROUND_CLIENT_ID) {
    return { error: 'La idea no pertenece a Primer Round' }
  }

  const captionRes = await generatePrimerRoundCaption(ideaId)
  if (captionRes.error) return { error: captionRes.error, caption: captionRes.caption }

  const { data: afterCaption } = await supabase
    .from('content_ideas')
    .select('generated_caption, caption_draft')
    .eq('id', ideaId)
    .maybeSingle()
  const draft =
    ((afterCaption?.generated_caption as string | null) ||
      (afterCaption?.caption_draft as string | null) ||
      captionRes.caption ||
      '')?.trim() || null
  if (draft && !(afterCaption?.generated_caption as string | null)?.trim()) {
    await supabase.from('content_ideas').update({ generated_caption: draft }).eq('id', ideaId)
  }

  const userId = await getEffectiveUserId()
  const videoId = input.videoId?.trim() || null
  if (idea.approval_status !== 'approved') {
    const { error: approveErr } = await supabase
      .from('content_ideas')
      .update({
        approval_status: 'approved' satisfies IdeaApprovalStatus,
        approved_by: userId,
        approved_at: new Date().toISOString(),
        approved_video_id: videoId,
      })
      .eq('id', ideaId)
    if (approveErr) return { error: approveErr.message, caption: draft }
  } else if (videoId) {
    await supabase
      .from('content_ideas')
      .update({ approved_video_id: videoId })
      .eq('id', ideaId)
      .is('approved_video_id', null)
  }

  const schedule = await schedulePrimerRoundReel({
    ideaId,
    overrideOrtho: !!input.overrideOrtho,
  })

  const verified = await verifyPrimerRoundOrtho(ideaId)

  if (schedule.error) {
    return {
      error: schedule.error,
      caption: draft,
      gate: verified.gate,
    }
  }
  if (schedule.skipped) {
    return {
      skipped: schedule.skipped,
      caption: draft,
      gate: verified.gate,
    }
  }

  revalidatePath('/primer-round')
  return {
    ok: true,
    caption: draft,
    gate: verified.gate,
    metricoolPostId: schedule.metricoolPostId ?? null,
  }
}
