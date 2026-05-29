import { describe, it, expect } from 'vitest'
import { computeIdeaProgress } from './idea-progress'
import type { ContentIdea, ContentIdeaVideo } from '@/lib/supabase/types'

const baseIdea = {
  hook: 'h',
  visual_brief: 'b',
  generated_caption: 'c',
  approval_status: 'approved',
  published_at: '2026-05-01T00:00:00Z',
} as Pick<ContentIdea, 'hook' | 'visual_brief' | 'generated_caption' | 'approval_status' | 'published_at'>

function vid(kind: ContentIdeaVideo['kind'], status: ContentIdeaVideo['status'] = 'uploaded') {
  return { kind, status } as ContentIdeaVideo
}

describe('computeIdeaProgress', () => {
  it('marks all 7 stages done when everything is complete', () => {
    const p = computeIdeaProgress({ idea: baseIdea, videos: [vid('raw'), vid('edited')], assetCount: 1 })
    expect(p.total).toBe(7)
    expect(p.completed).toBe(7)
    expect(p.percent).toBe(100)
    expect(p.missing).toEqual([])
    expect(p.stages.map((s) => s.key)).toEqual([
      'idea', 'caption', 'material', 'edited', 'assets', 'approval', 'published',
    ])
  })

  it('idea stage needs both hook and visual_brief', () => {
    const p = computeIdeaProgress({ idea: { ...baseIdea, visual_brief: null }, videos: [], assetCount: 0 })
    expect(p.stages.find((s) => s.key === 'idea')!.done).toBe(false)
  })

  it('treats whitespace-only caption as not done', () => {
    const p = computeIdeaProgress({ idea: { ...baseIdea, generated_caption: '   ' }, videos: [], assetCount: 0 })
    expect(p.stages.find((s) => s.key === 'caption')!.done).toBe(false)
  })

  it('material done at >=1 active raw; archived/failed do not count', () => {
    const done = computeIdeaProgress({ idea: baseIdea, videos: [vid('raw')], assetCount: 0 })
    expect(done.stages.find((s) => s.key === 'material')!.done).toBe(true)
    const archived = computeIdeaProgress({ idea: baseIdea, videos: [vid('raw', 'archived')], assetCount: 0 })
    const mat = archived.stages.find((s) => s.key === 'material')!
    expect(mat.done).toBe(false)
    expect(mat.count).toEqual({ current: 0, total: 4 })
  })

  it('edited stage counts active edited n/2', () => {
    const p = computeIdeaProgress({ idea: baseIdea, videos: [vid('edited'), vid('edited')], assetCount: 0 })
    expect(p.stages.find((s) => s.key === 'edited')!.count).toEqual({ current: 2, total: 2 })
  })

  it('assets done when assetCount >= 1', () => {
    expect(
      computeIdeaProgress({ idea: baseIdea, videos: [], assetCount: 0 }).stages.find((s) => s.key === 'assets')!.done,
    ).toBe(false)
    expect(
      computeIdeaProgress({ idea: baseIdea, videos: [], assetCount: 3 }).stages.find((s) => s.key === 'assets')!.done,
    ).toBe(true)
  })

  it('approval reflects sub-state and is done only when approved', () => {
    const rev = computeIdeaProgress({
      idea: { ...baseIdea, approval_status: 'revision_needed' },
      videos: [],
      assetCount: 0,
    })
    const a = rev.stages.find((s) => s.key === 'approval')!
    expect(a.done).toBe(false)
    expect(a.detail).toBe('Cambios pedidos')
  })

  it('published done by published_at independent of earlier stages', () => {
    const p = computeIdeaProgress({
      idea: { hook: null, visual_brief: null, generated_caption: null, approval_status: 'pending', published_at: '2026-05-01' },
      videos: [],
      assetCount: 0,
    })
    expect(p.stages.find((s) => s.key === 'published')!.done).toBe(true)
    expect(p.missing).toContain('Idea')
  })

  it('counts above the min are not capped in the count', () => {
    const p = computeIdeaProgress({
      idea: baseIdea,
      videos: [vid('raw'), vid('raw'), vid('raw'), vid('raw'), vid('raw')],
      assetCount: 0,
    })
    expect(p.stages.find((s) => s.key === 'material')!.count).toEqual({ current: 5, total: 4 })
    expect(p.percent).toBeLessThanOrEqual(100)
  })
})
