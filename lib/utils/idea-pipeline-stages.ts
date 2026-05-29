import type { ContentIdea, ContentIdeaVideo } from '@/lib/supabase/types'

export type PipelineStageKey =
  | 'idea' | 'caption' | 'scheduled' | 'recorded' | 'edited' | 'approval' | 'published'

export interface PipelineStage {
  key: PipelineStageKey
  label: string
  done: boolean
}

export interface IdeaPipeline {
  stages: PipelineStage[]
  currentIndex: number
  completed: number
  percent: number
}

const ACTIVE: ReadonlySet<ContentIdeaVideo['status']> = new Set<ContentIdeaVideo['status']>([
  'uploading',
  'uploaded',
  'processing',
])

type PipelineIdea = Pick<
  ContentIdea,
  | 'hook'
  | 'visual_brief'
  | 'generated_caption'
  | 'status'
  | 'approval_status'
  | 'published_at'
  | 'recording_session_id'
  | 'recording_date'
>

/**
 * Production pipeline stages for an idea/video, in order:
 *   Idea → Caption → Agendada → Grabación → Edición → Aprobación → Publicado.
 * Each stage is evaluated independently (no linear assumption) from existing data
 * plus a `recordingScheduled` flag (a linked recording session). `currentIndex`
 * points at the first not-done stage — i.e. "where it is" in the process.
 */
export function computeIdeaPipeline(input: {
  idea: PipelineIdea
  videos: ContentIdeaVideo[]
  recordingScheduled: boolean
}): IdeaPipeline {
  const { idea, videos, recordingScheduled } = input
  const filled = (s?: string | null) => !!s && s.trim().length > 0
  const activeOf = (kind: ContentIdeaVideo['kind']) =>
    videos.some((v) => v.kind === kind && ACTIVE.has(v.status))

  const stages: PipelineStage[] = [
    { key: 'idea', label: 'Idea', done: filled(idea.hook) && filled(idea.visual_brief) },
    { key: 'caption', label: 'Caption', done: filled(idea.generated_caption) },
    { key: 'scheduled', label: 'Agendada', done: recordingScheduled || idea.recording_session_id != null },
    { key: 'recorded', label: 'Grabación', done: idea.status === 'grabada' || idea.recording_date != null || activeOf('raw') },
    { key: 'edited', label: 'Edición', done: activeOf('edited') || idea.status === 'producida' },
    { key: 'approval', label: 'Aprobación', done: idea.approval_status === 'approved' },
    { key: 'published', label: 'Publicado', done: idea.published_at != null || idea.status === 'publicada' },
  ]

  const completed = stages.filter((s) => s.done).length
  const firstNotDone = stages.findIndex((s) => !s.done)
  return {
    stages,
    currentIndex: firstNotDone === -1 ? stages.length : firstNotDone,
    completed,
    percent: Math.round((completed / stages.length) * 100),
  }
}
