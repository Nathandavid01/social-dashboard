import type { IdeaWithPipeline } from '@/lib/supabase/types'
import { clientAssigneeId, ideaAssigneeId, isIdeaApproved } from './editor-video-bank'

/**
 * WIP dinámico del editor: el tope de videos activos sube con el volumen
 * aprobado y el % de aprobación. La meritocracia del banco — mejor trabajo,
 * más videos a la vez.
 *
 * PURO — sin imports de servidor; lo consumen componentes cliente del banco.
 */

export interface EditorApprovalStats {
  approved: number
  /** Devueltos: virados por el QC IA o por un admin (revision_needed). */
  returned: number
}

export const WIP_BASE = 2

const TIERS: Array<{ minApproved: number; minRate: number; limit: number }> = [
  { minApproved: 25, minRate: 0.9, limit: 4 },
  { minApproved: 10, minRate: 0.8, limit: 3 },
]

export function editorWipLimitFor(stats: EditorApprovalStats): number {
  const total = stats.approved + stats.returned
  if (total === 0) return WIP_BASE
  const rate = stats.approved / total
  for (const tier of TIERS) {
    if (stats.approved >= tier.minApproved && rate >= tier.minRate) return tier.limit
  }
  return WIP_BASE
}

/** Historial del editor sobre las ideas que le pertenecen (por idea o por cliente). */
export function editorApprovalStats(
  ideas: IdeaWithPipeline[],
  editorId: string | null,
): EditorApprovalStats {
  if (!editorId) return { approved: 0, returned: 0 }
  let approved = 0
  let returned = 0
  for (const idea of ideas) {
    if (ideaAssigneeId(idea) !== editorId && clientAssigneeId(idea) !== editorId) continue
    if (isIdeaApproved(idea)) approved++
    else if (idea.approval_status === 'revision_needed') returned++
  }
  return { approved, returned }
}
