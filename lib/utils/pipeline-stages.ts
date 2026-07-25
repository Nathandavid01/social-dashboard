import type { ContentIdea } from '@/lib/supabase/types'

/**
 * The 4 columns of the short Content Pipeline board (per product decision).
 * The process starts at the video: idea / title / caption all live inside the
 * first "Video" column. A card's column is derived from the furthest milestone
 * it has reached, so the board works without a status-enum migration.
 */
export const PIPELINE_STAGES = [
  { key: 'video', label: 'Video' },
  { key: 'edited', label: 'Edited Video' },
  { key: 'approval', label: 'Approval' },
  { key: 'copy', label: 'Copy' },
  { key: 'publication', label: 'Publication' },
] as const

export type PipelineStageKey = (typeof PIPELINE_STAGES)[number]['key']

/** Fields needed to place a card — a subset of ContentIdea. */
export type StageInput = Pick<
  ContentIdea,
  'status' | 'hook' | 'visual_brief' | 'generated_caption' | 'approval_status' | 'published_at'
>

/**
 * Furthest-reached column for a card, derived from existing content_ideas data.
 * Order matters: we check the most-advanced milestone first and fall back.
 * In the short 4-column board everything before the edit collapses to 'video'.
 */
export function computeStage(idea: StageInput): PipelineStageKey {
  if (idea.published_at || idea.status === 'publicada') return 'publication'
  // Approved by the internal reviewer: the video now waits in Copy until the
  // caption is written, and only then is it ready to go out to Metricool.
  if (idea.approval_status === 'approved') {
    return filled(idea.generated_caption) ? 'publication' : 'copy'
  }
  // Both `submitted` and `revision_needed` live in Approval — a video sent back
  // for changes must stay visible to the reviewer, not silently fall backwards.
  if (idea.approval_status === 'submitted' || idea.approval_status === 'revision_needed') {
    return 'approval'
  }
  if (idea.status === 'producida') return 'edited'
  return 'video'
}

const filled = (s?: string | null) => !!s && s.trim().length > 0

const STAGE_ORDER = PIPELINE_STAGES.map((s) => s.key)

/** Adjacent stage in the given direction, or null at the ends. */
export function adjacentStage(stage: PipelineStageKey, dir: 1 | -1): PipelineStageKey | null {
  const i = STAGE_ORDER.indexOf(stage)
  const j = i + dir
  return j >= 0 && j < STAGE_ORDER.length ? STAGE_ORDER[j] : null
}

/**
 * The content_ideas.status that best persists a board stage. The board stages
 * are derived, not stored; this maps each of the 4 columns to the base status.
 */
export function stageToStatus(stage: PipelineStageKey): 'grabada' | 'producida' | 'publicada' {
  switch (stage) {
    case 'video': return 'grabada'
    case 'edited':
    case 'approval':
    case 'copy': return 'producida'
    case 'publication': return 'publicada'
  }
}

/** Bucket a list of cards into the 4 columns, preserving input order. */
export function bucketByStage<T extends StageInput>(ideas: T[]): Record<PipelineStageKey, T[]> {
  const out = {
    video: [], edited: [], approval: [], copy: [], publication: [],
  } as Record<PipelineStageKey, T[]>
  for (const idea of ideas) out[computeStage(idea)].push(idea)
  return out
}
