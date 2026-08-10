import { describe, it, expect } from 'vitest'
import type { IdeaWithPipeline } from '@/lib/supabase/types'
import { countIdeasReadyToRecord, isIdeaReadyToRecord } from './pipeline-recording'

function idea(over: Partial<IdeaWithPipeline> = {}): IdeaWithPipeline {
  return {
    id: 'i',
    client_id: 'c1',
    content_type: 'R',
    title: 't',
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
    recordingScheduled: false,
    videos: [],
    assignee: null,
    client: { id: 'c1', name: 'Nora', industry: null },
    ...over,
  } as IdeaWithPipeline
}

describe('isIdeaReadyToRecord', () => {
  it('is true when caption is saved and video is not recorded yet', () => {
    expect(isIdeaReadyToRecord(idea({ generated_caption: 'Caption listo' }))).toBe(true)
  })

  it('is false before caption or after recording', () => {
    expect(isIdeaReadyToRecord(idea({ hook: 'h', visual_brief: 'v' }))).toBe(false)
    expect(isIdeaReadyToRecord(idea({ generated_caption: 'c', status: 'grabada' }))).toBe(false)
  })
})

describe('countIdeasReadyToRecord', () => {
  it('counts only the client’s pipeline videos ready to record', () => {
    const ideas = [
      idea({ id: '1', client_id: 'c1', generated_caption: 'a' }),
      idea({ id: '2', client_id: 'c1', hook: 'h', visual_brief: 'v' }),
      idea({ id: '3', client_id: 'c2', generated_caption: 'b' }),
    ]
    expect(countIdeasReadyToRecord(ideas, 'c1')).toBe(1)
  })
})
