import type {
  ContentIdea,
  ContentIdeaVideo,
  ContentIdeaVideoKind,
  IdeaApprovalStatus,
} from '@/lib/supabase/types'

export type StageKey = 'idea' | 'caption' | 'material' | 'edited' | 'assets' | 'approval' | 'published'

export interface StageProgress {
  key: StageKey
  label: string
  done: boolean
  count?: { current: number; total: number }
  detail?: string
}

export interface IdeaProgress {
  stages: StageProgress[]
  completed: number
  total: number
  percent: number
  missing: string[]
}

const MIN: Record<ContentIdeaVideoKind, number> = { raw: 4, broll: 4, edited: 2 }
const ACTIVE: ReadonlySet<ContentIdeaVideo['status']> = new Set(['uploading', 'uploaded', 'processing'])

const APPROVAL_DETAIL: Record<IdeaApprovalStatus, string> = {
  pending: 'Sin enviar',
  submitted: 'En revisión',
  approved: 'Aprobado',
  revision_needed: 'Cambios pedidos',
}

type ProgressIdea = Pick<
  ContentIdea,
  'hook' | 'visual_brief' | 'generated_caption' | 'approval_status' | 'published_at'
>

/**
 * Derives the 7 pipeline stages + an overall summary for an idea from existing
 * data only (no schema). Stages are evaluated independently — an out-of-order
 * `published_at` does not assume earlier stages are complete. "Done" for the
 * video stages is >= 1 active upload; counts are shown un-capped (e.g. 5/4) while
 * the overall percent is capped at 100.
 */
export function computeIdeaProgress(input: {
  idea: ProgressIdea
  videos: ContentIdeaVideo[]
  assetCount: number
}): IdeaProgress {
  const { idea, videos, assetCount } = input
  const active = (kind: ContentIdeaVideoKind) =>
    videos.filter((v) => v.kind === kind && ACTIVE.has(v.status)).length
  const filled = (s?: string | null) => !!s && s.trim().length > 0

  const rawN = active('raw')
  const editedN = active('edited')

  const stages: StageProgress[] = [
    { key: 'idea', label: 'Idea', done: filled(idea.hook) && filled(idea.visual_brief) },
    { key: 'caption', label: 'Caption', done: filled(idea.generated_caption) },
    { key: 'material', label: 'Material', done: rawN >= 1, count: { current: rawN, total: MIN.raw } },
    { key: 'edited', label: 'Editado', done: editedN >= 1, count: { current: editedN, total: MIN.edited } },
    { key: 'assets', label: 'Assets', done: assetCount >= 1, count: { current: assetCount, total: 1 } },
    {
      key: 'approval',
      label: 'Aprobación',
      done: idea.approval_status === 'approved',
      detail: APPROVAL_DETAIL[idea.approval_status],
    },
    { key: 'published', label: 'Publicado', done: idea.published_at != null },
  ]

  const completed = stages.filter((s) => s.done).length
  const total = stages.length
  return {
    stages,
    completed,
    total,
    percent: Math.min(100, Math.round((completed / total) * 100)),
    missing: stages.filter((s) => !s.done).map((s) => s.label),
  }
}
