import type { PipelineVideo } from '@/lib/actions/video-pipeline'
import type { ContentIdeaVideo } from '@/lib/supabase/types'

const ACTIVE: ReadonlySet<ContentIdeaVideo['status']> = new Set<ContentIdeaVideo['status']>([
  'uploading',
  'uploaded',
  'processing',
])

export function activeVideoCount(videos: ContentIdeaVideo[]): number {
  return videos.filter((v) => ACTIVE.has(v.status)).length
}

/**
 * True when a video has source material (>=1 active raw) but no active edited
 * video yet — i.e. it belongs in the editor's "ready to edit" queue. Discarded
 * ideas are excluded.
 */
export function isReadyToEdit(video: PipelineVideo): boolean {
  if (video.status === 'descartada') return false
  return activeVideoCount(video.videos.raw) >= 1 && activeVideoCount(video.videos.edited) === 0
}
