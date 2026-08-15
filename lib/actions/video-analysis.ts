'use server'

import { createClient } from '@/lib/supabase/server'
import { currentUserHas } from '@/lib/auth/server'
import type { VideoAnalysisFindings } from '@/lib/llm/video-analysis-core'

export interface VideoAnalysisView {
  status: 'pending' | 'done' | 'error'
  findings: VideoAnalysisFindings | null
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
  return {
    analysis: {
      status: data.status as VideoAnalysisView['status'],
      findings: (data.findings as VideoAnalysisFindings | null) ?? null,
    },
  }
}
