/**
 * Intake for already-recorded videos: the video skips Idea/Title/Caption and
 * enters the board at one of the post-recording columns. The user picks the
 * column; this maps that choice to the content_ideas status fields so the board
 * (ideaStage in content-batches.ts) places the card in that exact column.
 */
export const RECORDED_ENTRY_STAGES = ['video', 'edited', 'approval'] as const

export type RecordedEntryStage = (typeof RECORDED_ENTRY_STAGES)[number]

export interface RecordedEntryFields {
  status: 'grabada' | 'producida'
  approval_status?: 'submitted'
}

export function recordedEntryFields(stage: RecordedEntryStage): RecordedEntryFields {
  switch (stage) {
    case 'video':
      return { status: 'grabada' }
    case 'edited':
      return { status: 'producida' }
    case 'approval':
      return { status: 'producida', approval_status: 'submitted' }
  }
}

export function isRecordedEntryStage(value: unknown): value is RecordedEntryStage {
  return typeof value === 'string' && (RECORDED_ENTRY_STAGES as readonly string[]).includes(value)
}

import { BATCH_STAGES, type BatchStageKey } from './content-batches'

export interface EntryClassification {
  /** Stages the video skips (everything before the entry column). */
  skipped: BatchStageKey[]
  /** The column the video enters. */
  entry: BatchStageKey
  /** Stages still ahead of the video. */
  upcoming: BatchStageKey[]
}

/**
 * Split the full pipeline around the chosen entry column — drives the modal's
 * "Cómo se clasificará" indicator (skipped / entry / upcoming).
 */
export function classifyEntry(stage: RecordedEntryStage): EntryClassification {
  const keys = BATCH_STAGES.map((s) => s.key)
  const i = keys.indexOf(stage)
  return {
    skipped: keys.slice(0, i),
    entry: stage,
    upcoming: keys.slice(i + 1),
  }
}
