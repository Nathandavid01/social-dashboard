import { describe, expect, it } from 'vitest'
import type { ContentIdeaVideo, IdeaWithPipeline } from '@/lib/supabase/types'
import { buildEditorHistory, formatHistoryWhen } from './editor-history'

function raw(over: Partial<ContentIdeaVideo> = {}): ContentIdeaVideo {
  return {
    id: 'v1',
    idea_id: 'i1',
    kind: 'raw',
    name: 'crudo.mp4',
    drive_file_id: 'ideas/i1/raw/x',
    drive_view_link: null,
    drive_thumb_url: null,
    storage_provider: 'r2',
    mime_type: 'video/mp4',
    size_bytes: 10,
    duration_sec: null,
    notes: null,
    uploaded_by: 'vid-1',
    status: 'uploaded',
    error_message: null,
    uploaded_at: '2026-08-07T14:14:00.000Z',
    updated_at: '2026-08-07T14:14:00.000Z',
    ...over,
  }
}

function idea(over: Partial<IdeaWithPipeline> = {}): IdeaWithPipeline {
  return {
    id: 'i1',
    client_id: 'c1',
    content_type: 'R',
    title: 'Farmacia Buena Vida — video 1',
    hook: null,
    visual_brief: null,
    caption_angle: null,
    hashtags_suggestion: null,
    rationale: null,
    status: 'producida',
    production_task_id: null,
    recording_session_id: null,
    theme: null,
    generation_prompt: null,
    model: null,
    generated_caption: null,
    caption_draft: null,
    caption_platform: null,
    platform_formats: null,
    caption_generated_at: null,
    published_at: null,
    approval_status: 'submitted',
    approved_by: null,
    approved_at: null,
    submitted_at: '2026-08-07T18:14:00.000Z',
    recording_date: '2026-08-07',
    publish_date: null,
    deadline: null,
    metricool_post_id: null,
    metricool_uuid: null,
    posted_at: null,
    posting_error: null,
    posting_started_at: null,
    created_by: null,
    created_at: '2026-08-07T12:00:00.000Z',
    updated_at: '2026-08-07T18:14:00.000Z',
    recordingScheduled: true,
    videos: [raw()],
    assignee: { id: 'ed-1', full_name: 'Richard' },
    client: { id: 'c1', name: 'Farmacia Buena Vida', industry: null },
    ...over,
  } as IdeaWithPipeline
}

describe('buildEditorHistory cover', () => {
  it('usa la carátula del edited, si no la del crudo', () => {
    const items = buildEditorHistory([
      idea({
        videos: [
          raw({ id: 'raw1', kind: 'raw', drive_thumb_url: 'https://cdn.example/raw.jpg' }),
          raw({ id: 'ed1', kind: 'edited', drive_thumb_url: 'https://cdn.example/edit.jpg' }),
        ],
      }),
    ], 'ed-1')
    expect(items[0].thumbUrl).toBe('https://cdn.example/edit.jpg')
  })

  it('si no hay thumb de R2, usa el thumbnail de Drive', () => {
    const items = buildEditorHistory([
      idea({
        videos: [raw({
          storage_provider: 'drive',
          drive_file_id: 'ABCDEFGHIJKLMNOP',
          drive_thumb_url: null,
        })],
      }),
    ], 'ed-1')
    expect(items[0].thumbUrl).toContain('ABCDEFGHIJKLMNOP')
  })
})

describe('formatHistoryWhen', () => {
  it('da fecha y hora en Puerto Rico, no solo días', () => {
    const label = formatHistoryWhen('2026-08-07T18:14:00.000Z', '2026-08-25T16:00:00.000Z')
    expect(label).toMatch(/7 ago/)
    expect(label).toMatch(/p\.\s*m\.|PM|pm|2:14/i)
    expect(label).toMatch(/18\s*d|hace 18/)
  })
})
