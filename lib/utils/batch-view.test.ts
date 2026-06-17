import { describe, it, expect } from 'vitest'
import {
  contentTypeLabel,
  videoStageKey,
  batchStageKey,
  buildStepper,
  isRecorded,
  cardStatus,
  slotStatus,
  batchHint,
  type BatchVideo,
} from './batch-view'
import type { ContentIdeaVideo } from '@/lib/supabase/types'

function rawFile(): ContentIdeaVideo {
  return {
    id: 'v1',
    idea_id: 'i1',
    kind: 'raw',
    name: 'clip.mp4',
    drive_file_id: null,
    drive_view_link: null,
    drive_thumb_url: null,
    storage_provider: 'r2',
    mime_type: 'video/mp4',
    size_bytes: 1000,
    duration_sec: 42,
    notes: null,
    uploaded_by: null,
    status: 'uploaded',
    error_message: null,
    uploaded_at: '2026-06-01',
    updated_at: '2026-06-01',
  }
}

function mk(overrides: Partial<BatchVideo> = {}): BatchVideo {
  return {
    id: 'idea-1',
    client_id: 'c1',
    content_type: 'R',
    title: 'Video de prueba',
    hook: null,
    visual_brief: null,
    caption_angle: null,
    hashtags_suggestion: null,
    rationale: null,
    status: 'idea',
    production_task_id: null,
    recording_session_id: null,
    theme: null,
    generation_prompt: null,
    model: null,
    generated_caption: null,
    caption_platform: null,
    caption_generated_at: null,
    published_at: null,
    approval_status: 'pending',
    approved_by: null,
    approved_at: null,
    submitted_at: null,
    recording_date: null,
    publish_date: null,
    created_by: null,
    created_at: '2026-06-01',
    updated_at: '2026-06-01',
    videos: { raw: [], broll: [], edited: [] },
    ...overrides,
  } as BatchVideo
}

describe('contentTypeLabel', () => {
  it('maps known content_type codes to Spanish labels', () => {
    expect(contentTypeLabel('R')).toBe('Reel')
    expect(contentTypeLabel('C')).toBe('Carrusel')
    expect(contentTypeLabel('P')).toBe('Post')
    expect(contentTypeLabel('S')).toBe('Story')
  })
  it('falls back to "Video" for unknown/empty', () => {
    expect(contentTypeLabel('X')).toBe('Video')
    expect(contentTypeLabel(null)).toBe('Video')
    expect(contentTypeLabel(undefined)).toBe('Video')
  })
})

describe('videoStageKey', () => {
  it('is "idea" with no content', () => {
    expect(videoStageKey(mk())).toBe('idea')
  })
  it('is "caption" once hook and visual_brief are filled (idea ready)', () => {
    expect(videoStageKey(mk({ hook: 'gancho' }))).toBe('idea')
    expect(videoStageKey(mk({ visual_brief: 'brief' }))).toBe('idea')
    expect(videoStageKey(mk({ hook: 'gancho', visual_brief: 'brief' }))).toBe('caption')
  })
  it('is "caption" once a caption is generated', () => {
    expect(videoStageKey(mk({ hook: 'g', visual_brief: 'b', generated_caption: 'texto' }))).toBe('caption')
  })
  it('is "video" when a raw file is uploaded (even if status not advanced)', () => {
    expect(videoStageKey(mk({ generated_caption: 'c', videos: { raw: [rawFile()], broll: [], edited: [] } }))).toBe('video')
  })
  it('is "video" when status is grabada or a recording_date exists', () => {
    expect(videoStageKey(mk({ status: 'grabada' }))).toBe('video')
    expect(videoStageKey(mk({ recording_date: '2026-06-11' }))).toBe('video')
  })
  it('is "edited" when an edited file exists or status producida', () => {
    expect(videoStageKey(mk({ videos: { raw: [], broll: [], edited: [rawFile()] } }))).toBe('edited')
    expect(videoStageKey(mk({ status: 'producida' }))).toBe('edited')
  })
  it('is "approval" when submitted/approved, and "publication" when published', () => {
    expect(videoStageKey(mk({ approval_status: 'submitted' }))).toBe('approval')
    expect(videoStageKey(mk({ approval_status: 'approved' }))).toBe('approval')
    expect(videoStageKey(mk({ published_at: '2026-06-20' }))).toBe('publication')
    expect(videoStageKey(mk({ status: 'publicada' }))).toBe('publication')
  })
})

describe('batchStageKey', () => {
  it('returns "idea" for an empty batch', () => {
    expect(batchStageKey([])).toBe('idea')
  })
  it('returns the LEAST-advanced active video stage (videos move together)', () => {
    const videos = [
      mk({ id: 'a', status: 'grabada' }), // video
      mk({ id: 'b', hook: 'g' }), // idea (partial)
    ]
    expect(batchStageKey(videos)).toBe('idea')
  })
  it('ignores discarded videos', () => {
    const videos = [
      mk({ id: 'a', status: 'descartada' }),
      mk({ id: 'b', status: 'grabada' }),
    ]
    expect(batchStageKey(videos)).toBe('video')
  })
  it('returns "publication" only when all active videos are published', () => {
    const videos = [
      mk({ id: 'a', status: 'publicada' }),
      mk({ id: 'b', published_at: '2026-06-20' }),
    ]
    expect(batchStageKey(videos)).toBe('publication')
  })
})

describe('buildStepper', () => {
  it('marks earlier stages done, the current stage current, later ones neither', () => {
    const stepper = buildStepper([mk({ status: 'grabada' })]) // batch at "video"
    const byKey = Object.fromEntries(stepper.map((s) => [s.key, s]))
    expect(byKey.idea.done).toBe(true)
    expect(byKey.title.done).toBe(true)
    expect(byKey.caption.done).toBe(true)
    expect(byKey.video.current).toBe(true)
    expect(byKey.video.done).toBe(false)
    expect(byKey.edited.done).toBe(false)
    expect(byKey.edited.current).toBe(false)
  })
  it('uses Spanish labels', () => {
    const labels = buildStepper([]).map((s) => s.label)
    expect(labels).toEqual(['Idea', 'Título', 'Caption', 'Video', 'Edición', 'Aprobación', 'Publicación'])
  })
})

describe('cardStatus / isRecorded', () => {
  it('is "Por grabar" before the video stage', () => {
    expect(isRecorded(mk({ hook: 'g' }))).toBe(false)
    expect(cardStatus(mk({ hook: 'g' })).label).toBe('Por grabar')
  })
  it('is "Grabado" once a raw file exists', () => {
    const v = mk({ videos: { raw: [rawFile()], broll: [], edited: [] } })
    expect(isRecorded(v)).toBe(true)
    expect(cardStatus(v).label).toBe('Grabado')
  })
})

describe('slotStatus', () => {
  it('is Listo when a file exists', () => {
    expect(slotStatus(2)).toEqual({ label: 'Listo', tone: 'ready' })
  })
  it('is Pendiente when required and empty, Opcional when optional and empty', () => {
    expect(slotStatus(0)).toEqual({ label: 'Pendiente', tone: 'pending' })
    expect(slotStatus(0, true)).toEqual({ label: 'Opcional', tone: 'muted' })
  })
})

describe('batchHint', () => {
  it('returns the current stage label and an actionable tip', () => {
    const hint = batchHint([mk({ status: 'grabada' })])
    expect(hint.stageLabel).toBe('Video')
    expect(hint.tip).toMatch(/raw/i)
  })
})
