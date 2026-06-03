import { describe, it, expect } from 'vitest'
import { computeStage, bucketByStage, adjacentStage, stageToStatus, PIPELINE_STAGES, type StageInput } from './pipeline-stages'

function idea(over: Partial<StageInput> = {}): StageInput {
  return {
    status: 'idea',
    hook: null,
    visual_brief: null,
    generated_caption: null,
    approval_status: 'pending',
    published_at: null,
    ...over,
  }
}

describe('computeStage — furthest milestone reached', () => {
  it('bare card with only a title → title', () => {
    expect(computeStage(idea())).toBe('title')
  })
  it('hook or visual brief filled → idea', () => {
    expect(computeStage(idea({ hook: 'Un gancho' }))).toBe('idea')
    expect(computeStage(idea({ visual_brief: 'Plano abierto' }))).toBe('idea')
  })
  it('caption written → caption', () => {
    expect(computeStage(idea({ hook: 'x', generated_caption: 'Caption listo' }))).toBe('caption')
  })
  it('grabada → video', () => {
    expect(computeStage(idea({ status: 'grabada', generated_caption: 'c' }))).toBe('video')
  })
  it('producida → edited', () => {
    expect(computeStage(idea({ status: 'producida' }))).toBe('edited')
  })
  it('approval submitted or approved → approval', () => {
    expect(computeStage(idea({ status: 'producida', approval_status: 'submitted' }))).toBe('approval')
    expect(computeStage(idea({ status: 'producida', approval_status: 'approved' }))).toBe('approval')
  })
  it('published wins over everything', () => {
    expect(computeStage(idea({ status: 'publicada' }))).toBe('publication')
    expect(computeStage(idea({ published_at: '2026-06-01T00:00:00Z', approval_status: 'approved' }))).toBe('publication')
  })
})

describe('adjacentStage', () => {
  it('moves forward and backward', () => {
    expect(adjacentStage('idea', 1)).toBe('caption')
    expect(adjacentStage('idea', -1)).toBe('title')
  })
  it('returns null at the ends', () => {
    expect(adjacentStage('title', -1)).toBeNull()
    expect(adjacentStage('publication', 1)).toBeNull()
  })
})

describe('stageToStatus', () => {
  it('maps board stages to the persisting base status', () => {
    expect(stageToStatus('title')).toBe('idea')
    expect(stageToStatus('idea')).toBe('idea')
    expect(stageToStatus('caption')).toBe('idea')
    expect(stageToStatus('video')).toBe('grabada')
    expect(stageToStatus('edited')).toBe('producida')
    expect(stageToStatus('approval')).toBe('producida')
    expect(stageToStatus('publication')).toBe('publicada')
  })
})

describe('bucketByStage', () => {
  it('groups cards into the 7 columns and preserves order', () => {
    const cards = [
      idea({ status: 'publicada' }),
      idea({ hook: 'h' }),
      idea(),
    ]
    const b = bucketByStage(cards)
    expect(b.publication).toHaveLength(1)
    expect(b.idea).toHaveLength(1)
    expect(b.title).toHaveLength(1)
    expect(Object.keys(b)).toEqual(PIPELINE_STAGES.map((s) => s.key))
  })
})
