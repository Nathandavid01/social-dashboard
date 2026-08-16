'use server'

import { createClient } from '@/lib/supabase/server'
import { currentUserHas } from '@/lib/auth/server'
import type { VideoAnalysisFindings } from '@/lib/llm/video-analysis-core'

export interface VideoAnalysisView {
  status: 'pending' | 'done' | 'error'
  findings: VideoAnalysisFindings | null
  /** true si la idea ya tiene un caption escrito por IA (`caption_draft`) o
   *  guardado por un humano (`generated_caption`). Independiente del estado
   *  del QC de video: alimenta la 3ra bolita ("Caption generado"). */
  hasCaption: boolean
}

/**
 * El análisis IA del video editado VIGENTE (no la fila más reciente por
 * `updated_at`): re-subir un video crea una fila `content_idea_videos` nueva,
 * y una barrida de la cron puede tocar `updated_at` de una fila 'error' vieja
 * (v1) después de que v2 ya completó 'done' — mirar "la fila más nueva de la
 * idea" tapa el análisis vigente con ese 'error' fantasma. SOLO superficies
 * internas — los links públicos de cliente jamás llaman esto. `analysis: null`
 * = no hay (incluye tabla sin migrar o sin video editado: degrada seguro).
 */
export async function getVideoAnalysis(
  ideaId: string,
): Promise<{ analysis?: VideoAnalysisView | null; error?: string }> {
  const allowed =
    (await currentUserHas('revision.read')) ||
    (await currentUserHas('entregas.read')) ||
    (await currentUserHas('planning.read'))
  if (!allowed) return { error: 'No autorizado' }

  const supabase = await createClient()

  const { data: video, error: videoError } = await supabase
    .from('content_idea_videos')
    .select('id')
    .eq('idea_id', ideaId)
    .eq('kind', 'edited')
    .not('status', 'in', '(archived,failed)')
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (videoError || !video) return { analysis: null }

  const { data, error } = await supabase
    .from('content_idea_video_analysis')
    .select('status, findings')
    .eq('video_id', video.id)
    .maybeSingle()

  if (error) return { analysis: null } // tabla sin migrar u otro fallo: degrada
  if (!data) return { analysis: null }

  // hasCaption es independiente del QC de video (no hay `if` que lo bloquee
  // en pending/error): un fallo aquí SOLO apaga esta bandera, nunca tumba el
  // análisis ya resuelto arriba.
  let hasCaption = false
  try {
    const { data: idea, error: ideaError } = await supabase
      .from('content_ideas')
      .select('caption_draft, generated_caption')
      .eq('id', ideaId)
      .maybeSingle()
    if (!ideaError && idea) {
      hasCaption = !!(idea.caption_draft?.trim() || idea.generated_caption?.trim())
    }
  } catch {
    hasCaption = false
  }

  return {
    analysis: {
      status: data.status as VideoAnalysisView['status'],
      findings: (data.findings as VideoAnalysisFindings | null) ?? null,
      hasCaption,
    },
  }
}
