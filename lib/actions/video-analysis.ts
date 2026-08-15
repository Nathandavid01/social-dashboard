'use server'

import { createClient } from '@/lib/supabase/server'
import { currentUserHas } from '@/lib/auth/server'
import type { VideoAnalysisFindings } from '@/lib/llm/video-analysis-core'

export interface VideoAnalysisView {
  status: 'pending' | 'done' | 'error'
  findings: VideoAnalysisFindings | null
}

/**
 * El análisis IA más reciente de la idea. SOLO superficies internas — los
 * links públicos de cliente jamás llaman esto. `analysis: null` = no hay
 * (incluye tabla sin migrar: degrada seguro).
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
  const { data, error } = await supabase
    .from('content_idea_video_analysis')
    .select('status, findings')
    .eq('idea_id', ideaId)
    .order('updated_at', { ascending: false })
    .limit(1)
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
