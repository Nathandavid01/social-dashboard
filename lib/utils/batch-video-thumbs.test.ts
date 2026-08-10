import { describe, expect, it } from 'vitest'
import type { ContentIdeaVideo, IdeaWithPipeline } from '@/lib/supabase/types'
import { pickBatchEditedVideos } from './batch-video-thumbs'

function video(over: Partial<ContentIdeaVideo> & { id: string }): ContentIdeaVideo {
  return {
    idea_id: 'idea-1',
    kind: 'edited',
    name: 'clip.mp4',
    drive_file_id: `entregas/x/edited/${over.id}.mp4`,
    drive_view_link: null,
    drive_thumb_url: null,
    storage_provider: 'entregas-r2',
    mime_type: 'video/mp4',
    size_bytes: 1000,
    duration_sec: null,
    notes: null,
    uploaded_by: null,
    status: 'uploaded',
    error_message: null,
    uploaded_at: '2026-08-10T12:00:00Z',
    updated_at: '2026-08-10T12:00:00Z',
    ...over,
  }
}

function idea(over: Partial<IdeaWithPipeline> = {}): IdeaWithPipeline {
  return {
    id: 'idea-1',
    client_id: 'c1',
    content_type: 'R',
    title: 't',
    status: 'grabada',
    videos: [],
    client: { id: 'c1', name: 'Speedy Net', industry: null },
    ...over,
  } as IdeaWithPipeline
}

describe('pickBatchEditedVideos', () => {
  it('returns only edited non-archived videos, newest first, max 3', () => {
    const ideas = [
      idea({
        id: 'i1',
        videos: [
          video({ id: 'v-raw', kind: 'raw', uploaded_at: '2026-08-10T15:00:00Z' }),
          video({ id: 'v1', uploaded_at: '2026-08-10T10:00:00Z', name: 'old.mp4' }),
          video({ id: 'v2', uploaded_at: '2026-08-10T14:00:00Z', name: 'new.mp4' }),
          video({ id: 'v3', uploaded_at: '2026-08-10T12:00:00Z', name: 'mid.mp4' }),
          video({ id: 'v4', uploaded_at: '2026-08-10T13:00:00Z', name: 'mid2.mp4' }),
          video({ id: 'v-arch', status: 'archived', uploaded_at: '2026-08-10T16:00:00Z' }),
        ],
      }),
    ]
    const picked = pickBatchEditedVideos(ideas, 3)
    expect(picked.map((p) => p.id)).toEqual(['v2', 'v4', 'v3'])
    expect(picked[0].name).toBe('new.mp4')
  })

  it('returns empty when editors have not uploaded yet', () => {
    const ideas = [idea({ videos: [video({ id: 'r1', kind: 'raw' })] })]
    expect(pickBatchEditedVideos(ideas)).toEqual([])
  })

  it('dedupes the same video id across ideas', () => {
    const shared = video({ id: 'same', uploaded_at: '2026-08-10T12:00:00Z' })
    const ideas = [idea({ id: 'i1', videos: [shared] }), idea({ id: 'i2', videos: [shared] })]
    expect(pickBatchEditedVideos(ideas)).toHaveLength(1)
  })
})
