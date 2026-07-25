import type { ContentIdea } from '@/lib/supabase/types'

/**
 * The 4 columns of the Content Pipeline board (per product decision).
 * The pipeline starts when the EDITOR delivers: they pick the client, paste the
 * Drive link, and the card enters at "Editado". Recording/idea work happens
 * before the board and has no column. A card's column is derived from the
 * furthest milestone it has reached, so this needs no status-enum migration.
 */
export const PIPELINE_STAGES = [
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
  // Nothing sent to review yet: the card sits in Editado, the board's entry point.
  return 'edited'
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
export function stageToStatus(stage: PipelineStageKey): 'producida' | 'publicada' {
  switch (stage) {
    case 'edited':
    case 'approval':
    case 'copy': return 'producida'
    case 'publication': return 'publicada'
  }
}

/** Bucket a list of cards into the 4 columns, preserving input order. */
export function bucketByStage<T extends StageInput>(ideas: T[]): Record<PipelineStageKey, T[]> {
  const out = Object.fromEntries(
    PIPELINE_STAGES.map((s) => [s.key, [] as T[]]),
  ) as Record<PipelineStageKey, T[]>
  for (const idea of ideas) out[computeStage(idea)].push(idea)
  return out
}
