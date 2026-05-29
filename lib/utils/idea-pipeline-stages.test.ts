import { describe, it, expect } from 'vitest'
import { computeIdeaPipeline } from './idea-pipeline-stages'
import type { ContentIdea, ContentIdeaVideo } from '@/lib/supabase/types'

const base = {
  hook: 'h',
  visual_brief: 'b',
  generated_caption: 'c',
  status: 'idea',
  approval_status: 'pending',
  published_at: null,
  recording_session_id: null,
  recording_date: null,
} as Pick<
  ContentIdea,
  'hook' | 'visual_brief' | 'generated_caption' | 'status' | 'approval_status' | 'published_at' | 'recording_session_id' | 'recording_date'
>

const raw = { kind: 'raw', status: 'uploaded' } as ContentIdeaVideo
const edited = { kind: 'edited', status: 'uploaded' } as ContentIdeaVideo

describe('computeIdeaPipeline', () => {
  it('returns the 7 stages in order', () => {
    const p = computeIdeaPipeline({ idea: base, videos: [], recordingScheduled: false })
    expect(p.stages.map((s) => s.key)).toEqual([
      'idea', 'caption', 'scheduled', 'recorded', 'edited', 'approval', 'published',
    ])
  })

  it('idea done needs hook + visual_brief', () => {
    expect(computeIdeaPipeline({ idea: base, videos: [], recordingScheduled: false }).stages[0].done).toBe(true)
    expect(
      computeIdeaPipeline({ idea: { ...base, visual_brief: null }, videos: [], recordingScheduled: false }).stages[0].done,
    ).toBe(false)
  })

  it('scheduled reflects recordingScheduled or a linked session', () => {
    expect(computeIdeaPipeline({ idea: base, videos: [], recordingScheduled: true }).stages[2].done).toBe(true)
    expect(computeIdeaPipeline({ idea: base, videos: [], recordingScheduled: false }).stages[2].done).toBe(false)
    expect(
      computeIdeaPipeline({ idea: { ...base, recording_session_id: 's1' }, videos: [], recordingScheduled: false }).stages[2].done,
    ).toBe(true)
  })

  it('recorded done via status, recording_date, or active raw (not archived)', () => {
    expect(computeIdeaPipeline({ idea: { ...base, status: 'grabada' }, videos: [], recordingScheduled: false }).stages[3].done).toBe(true)
    expect(computeIdeaPipeline({ idea: { ...base, recording_date: '2026-05-01' }, videos: [], recordingScheduled: false }).stages[3].done).toBe(true)
    expect(computeIdeaPipeline({ idea: base, videos: [raw], recordingScheduled: false }).stages[3].done).toBe(true)
    expect(computeIdeaPipeline({ idea: base, videos: [{ ...raw, status: 'archived' }], recordingScheduled: false }).stages[3].done).toBe(false)
  })

  it('edited done via active edited or producida', () => {
    expect(computeIdeaPipeline({ idea: base, videos: [edited], recordingScheduled: false }).stages[4].done).toBe(true)
    expect(computeIdeaPipeline({ idea: { ...base, status: 'producida' }, videos: [], recordingScheduled: false }).stages[4].done).toBe(true)
  })

  it('approval + published', () => {
    expect(computeIdeaPipeline({ idea: { ...base, approval_status: 'approved' }, videos: [], recordingScheduled: false }).stages[5].done).toBe(true)
    expect(computeIdeaPipeline({ idea: { ...base, published_at: '2026-05-01' }, videos: [], recordingScheduled: false }).stages[6].done).toBe(true)
    expect(computeIdeaPipeline({ idea: { ...base, status: 'publicada' }, videos: [], recordingScheduled: false }).stages[6].done).toBe(true)
  })

  it('currentIndex is the first not-done; percent reflects completed', () => {
    const p = computeIdeaPipeline({ idea: base, videos: [], recordingScheduled: false }) // idea + caption done
    expect(p.currentIndex).toBe(2)
    expect(p.completed).toBe(2)
    expect(p.percent).toBe(Math.round((2 / 7) * 100))
  })

  it('currentIndex points past the end when all stages are done', () => {
    const p = computeIdeaPipeline({
      idea: { ...base, status: 'publicada', approval_status: 'approved', recording_session_id: 's1', recording_date: '2026-05-01' },
      videos: [raw, edited],
      recordingScheduled: true,
    })
    expect(p.completed).toBe(7)
    expect(p.currentIndex).toBe(7)
    expect(p.percent).toBe(100)
  })
})
