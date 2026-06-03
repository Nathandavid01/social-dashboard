import type { ContentIdea } from '@/lib/supabase/types'

/**
 * The 7 columns of the global Content Pipeline board (image reference).
 * Video Raw + B-roll are a single "Video" column (per product decision).
 *
 * Phase 1 derives a card's column from the data it already has (the furthest
 * milestone reached), so the board works before the status enum is migrated.
 * Phase 3 will anchor drag to a real status with the same keys.
 */
export const PIPELINE_STAGES = [
  { key: 'title', label: 'Title' },
  { key: 'idea', label: 'Idea' },
  { key: 'caption', label: 'Caption' },
  { key: 'video', label: 'Video' },
  { key: 'edited', label: 'Edited Video' },
  { key: 'approval', label: 'Approval' },
  { key: 'publication', label: 'Publication' },
] as const

export type PipelineStageKey = (typeof PIPELINE_STAGES)[number]['key']

/** Fields needed to place a card — a subset of ContentIdea. */
export type StageInput = Pick<
  ContentIdea,
  'status' | 'hook' | 'visual_brief' | 'generated_caption' | 'approval_status' | 'published_at'
>

const filled = (s?: string | null) => !!s && s.trim().length > 0

/**
 * Furthest-reached column for a card, derived from existing content_ideas data.
 * Order matters: we check the most-advanced milestone first and fall back.
 */
export function computeStage(idea: StageInput): PipelineStageKey {
  if (idea.published_at || idea.status === 'publicada') return 'publication'
  if (idea.approval_status === 'approved' || idea.approval_status === 'submitted') return 'approval'
  if (idea.status === 'producida') return 'edited'
  if (idea.status === 'grabada') return 'video'
  if (filled(idea.generated_caption)) return 'caption'
  if (filled(idea.hook) || filled(idea.visual_brief)) return 'idea'
  return 'title'
}

const STAGE_ORDER = PIPELINE_STAGES.map((s) => s.key)

/** Adjacent stage in the given direction, or null at the ends. */
export function adjacentStage(stage: PipelineStageKey, dir: 1 | -1): PipelineStageKey | null {
  const i = STAGE_ORDER.indexOf(stage)
  const j = i + dir
  return j >= 0 && j < STAGE_ORDER.length ? STAGE_ORDER[j] : null
}

/**
 * The content_ideas.status that best persists a board stage today (before the
 * pipeline_stage column migration). Sub-stages share a base status; exact
 * 7-stage persistence arrives with migration 0031.
 */
export function stageToStatus(stage: PipelineStageKey): 'idea' | 'grabada' | 'producida' | 'publicada' {
  switch (stage) {
    case 'video': return 'grabada'
    case 'edited':
    case 'approval': return 'producida'
    case 'publication': return 'publicada'
    default: return 'idea' // title, idea, caption
  }
}

/** Bucket a list of cards into the 7 columns, preserving input order. */
export function bucketByStage<T extends StageInput>(ideas: T[]): Record<PipelineStageKey, T[]> {
  const out = {
    title: [], idea: [], caption: [], video: [], edited: [], approval: [], publication: [],
  } as Record<PipelineStageKey, T[]>
  for (const idea of ideas) out[computeStage(idea)].push(idea)
  return out
}
