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

  const base = { checkedAt: new Date().toISOString(), framesAnalyzed: input.frames.length }
  let report: SceneCheckReport

  const apiKey = (process.env.XAI_API_KEY ?? '').trim()
  if (!input.frames.length) {
    report = { ...base, status: 'skipped', issues: [], videoTopic: null, error: 'No se pudieron capturar frames del video.' }
  } else if (!apiKey) {
    report = { ...base, status: 'skipped', issues: [], videoTopic: null, error: 'XAI_API_KEY no está configurado en el servidor.' }
  } else {
    try {
      const req = buildSceneCheckRequest({
        frames: input.frames,
        apiKey,
        model: sceneCheckModelId(process.env),
      })
      const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        report = { ...base, status: 'error', issues: [], videoTopic: null, error: `Grok API ${res.status}: ${detail.slice(0, 300)}` }
      } else {
        const parsed = parseSceneCheckResponse(await res.json(), input.frames)
        report = parsed
          ? { ...base, status: parsed.issues.length ? 'issues' : 'ok', issues: parsed.issues, videoTopic: parsed.videoTopic }
          : { ...base, status: 'error', issues: [], videoTopic: null, error: 'La AI no devolvió un reporte legible.' }
      }
    } catch (err) {
      report = { ...base, status: 'error', issues: [], videoTopic: null, error: err instanceof Error ? err.message : 'Error de red' }
    }
  }

  await supabase.from('content_idea_videos').update({ scene_check: report }).eq('id', input.videoId)

  await logIdeaActivity(supabase, {
    ideaId: input.ideaId,
    userId: user?.id ?? null,
    action: 'scene_check_completed',
    metadata: { videoId: input.videoId, status: report.status, issueCount: report.issues.length },
  })

  // ── Caption automático: solo si la idea no tiene caption. ──
  const { data: idea } = await supabase
    .from('content_ideas')
    .select('id, hook, generated_caption')
    .eq('id', input.ideaId)
    .single()
  if (idea && !idea.generated_caption) {
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
