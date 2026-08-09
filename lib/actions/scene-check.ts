'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { logIdeaActivity } from '@/lib/utils/idea-activity'
import { generateIdeaCaption } from '@/lib/actions/idea-captions'
import {
  buildSceneCheckRequest,
  parseSceneCheckResponse,
  sceneCheckModelId,
} from '@/lib/llm/scene-check-core'
import type { SceneCheckReport } from '@/lib/llm/scene-check-types'

/** Tope de frames enviados a Grok por request, y tamaño máximo aceptado por frame. */
const MAX_FRAMES = 12
const MAX_B64_CHARS = 400_000
const BASE64_RE = /^[A-Za-z0-9+/=]+$/

/**
 * Revisión AI de subtítulos del video recién subido (Grok visión) + caption
 * automático si falta. Espíritu del spec: esto NUNCA rompe la subida — todo
 * fallo termina como reporte 'error'/'skipped' guardado, no como excepción.
 */
export async function analyzeUploadedVideo(input: {
  videoId: string
  ideaId: string
  frames: Array<{ b64: string; second: number }>
}): Promise<{ ok?: true; report?: SceneCheckReport; error?: string }> {
  try {
    await requirePermission('video.upload')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ── I2: el video debe existir, ser 'edited' y pertenecer a la idea. ──
  const { data: video } = await supabase
    .from('content_idea_videos')
    .select('id, kind, idea_id')
    .eq('id', input.videoId)
    .single()
  if (!video || video.kind !== 'edited' || video.idea_id !== input.ideaId) {
    return { error: 'Video no encontrado o no corresponde a la idea.' }
  }

  // Se carga una sola vez: alimenta la comparación cliente/video y luego el
  // caption, garantizando el orden revisión → guardado → caption.
  const { data: idea } = await supabase
    .from('content_ideas')
    .select('id, title, hook, visual_brief, generated_caption, client:clients(name, industry, brand_voice)')
    .eq('id', input.ideaId)
    .single()
  const client = (idea?.client ?? null) as {
    name?: string | null
    industry?: string | null
    brand_voice?: string | null
  } | null

  // ── I1: límites server-side de payload — nunca confiar en lo que manda el cliente. ──
  const validFrames = input.frames
    .slice(0, MAX_FRAMES)
    .filter((f) => f.b64.length > 0 && f.b64.length <= MAX_B64_CHARS && BASE64_RE.test(f.b64))

  const base = { checkedAt: new Date().toISOString(), framesAnalyzed: validFrames.length }
  let report: SceneCheckReport

  const apiKey = (process.env.XAI_API_KEY ?? '').trim()
  if (!input.frames.length) {
    report = { ...base, status: 'skipped', issues: [], videoTopic: null, error: 'No se pudieron capturar frames del video.' }
  } else if (!validFrames.length) {
    report = { ...base, status: 'skipped', issues: [], videoTopic: null, error: 'Frames inválidos o demasiado grandes.' }
  } else if (!apiKey) {
    report = { ...base, status: 'skipped', issues: [], videoTopic: null, error: 'XAI_API_KEY no está configurado en el servidor.' }
  } else {
    try {
      const req = buildSceneCheckRequest({
        frames: validFrames,
        clientContext: {
          name: client?.name?.trim() || 'Cliente no identificado',
          industry: client?.industry?.trim() || null,
          brandVoice: client?.brand_voice?.trim() || null,
          ideaTitle: idea?.title?.trim() || null,
          ideaTopic: idea?.hook?.trim() || null,
          visualBrief: idea?.visual_brief?.trim() || null,
        },
        apiKey,
        model: sceneCheckModelId(process.env),
      })
      const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        report = { ...base, status: 'error', issues: [], videoTopic: null, error: `Grok API ${res.status}: ${detail.slice(0, 300)}` }
      } else {
        const parsed = parseSceneCheckResponse(await res.json(), validFrames)
        report = parsed
          ? {
              ...base,
              status: parsed.issues.length ? 'issues' : 'ok',
              issues: parsed.issues,
              videoTopic: parsed.videoTopic,
              clientMatch: parsed.clientMatch,
            }
          : { ...base, status: 'error', issues: [], videoTopic: null, error: 'La AI no devolvió un reporte legible.' }
      }
    } catch (err) {
      report = { ...base, status: 'error', issues: [], videoTopic: null, error: err instanceof Error ? err.message : 'Error de red' }
    }
  }

  const { error: updateErr } = await supabase
    .from('content_idea_videos')
    .update({ scene_check: report })
    .eq('id', input.videoId)
  if (updateErr) {
    console.error('[scene-check] no se pudo guardar el reporte', updateErr)
    return { error: 'No se pudo guardar el reporte.' }
  }

  await logIdeaActivity(supabase, {
    ideaId: input.ideaId,
    userId: user?.id ?? null,
    action: 'scene_check_completed',
    metadata: {
      videoId: input.videoId,
      status: report.status,
      issueCount: report.issues.length,
      clientMatchStatus: report.clientMatch?.status ?? null,
    },
  })

  // ── Caption automático: solo si la idea no tiene caption. ──
  if (idea && !idea.generated_caption?.trim()) {
    const hasTopic = typeof idea.hook === 'string' && idea.hook.trim().length > 0
    if (hasTopic) {
      await generateIdeaCaption(input.ideaId, {}).catch(() => null)
    } else if (report.videoTopic) {
      await generateIdeaCaption(input.ideaId, { topicOverride: report.videoTopic }).catch(() => null)
    }
    // sin hook y sin videoTopic: se queda como hoy (botón manual)
  }

  revalidatePath(`/produccion/idea/${input.ideaId}`)
  revalidatePath('/pipeline')
  return { ok: true, report }
}
