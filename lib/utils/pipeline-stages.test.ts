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
  it('bare card (pre-edit) → video', () => {
    expect(computeStage(idea())).toBe('video')
  })
  it('hook or visual brief filled → still video (collapsed)', () => {
    expect(computeStage(idea({ hook: 'Un gancho' }))).toBe('video')
    expect(computeStage(idea({ visual_brief: 'Plano abierto' }))).toBe('video')
  })
  it('caption written → still video (collapsed)', () => {
    expect(computeStage(idea({ hook: 'x', generated_caption: 'Caption listo' }))).toBe('video')
  })
  it('grabada → video', () => {
    expect(computeStage(idea({ status: 'grabada', generated_caption: 'c' }))).toBe('video')
  })
  it('producida → edited', () => {
    expect(computeStage(idea({ status: 'producida' }))).toBe('edited')
  })
  it('submitted for internal review → approval', () => {
    expect(computeStage(idea({ status: 'producida', approval_status: 'submitted' }))).toBe('approval')
  })
  it('reviewer sent it back for changes → stays in approval (visible to the editor)', () => {
    expect(computeStage(idea({ status: 'producida', approval_status: 'revision_needed' }))).toBe('approval')
  })
  it('approved but no copy written yet → copy', () => {
    expect(computeStage(idea({ status: 'producida', approval_status: 'approved' }))).toBe('copy')
  })
  it('approved with the copy written → publication (ready for Metricool)', () => {
    expect(
      computeStage(idea({ status: 'producida', approval_status: 'approved', generated_caption: 'Copy listo' })),
    ).toBe('publication')
  })
  it('blank copy does not count as written', () => {
    expect(
      computeStage(idea({ status: 'producida', approval_status: 'approved', generated_caption: '   ' })),
    ).toBe('copy')
  })
  it('published wins over everything', () => {
    expect(computeStage(idea({ status: 'publicada' }))).toBe('publication')
    expect(computeStage(idea({ published_at: '2026-06-01T00:00:00Z', approval_status: 'approved' }))).toBe('publication')
  })
})

describe('adjacentStage', () => {
  it('moves forward and backward', () => {
    expect(adjacentStage('video', 1)).toBe('edited')
    expect(adjacentStage('edited', -1)).toBe('video')
  })
  it('walks through copy between approval and publication', () => {
    expect(adjacentStage('approval', 1)).toBe('copy')
    expect(adjacentStage('copy', 1)).toBe('publication')
    expect(adjacentStage('publication', -1)).toBe('copy')
    expect(adjacentStage('copy', -1)).toBe('approval')
  })
  it('returns null at the ends', () => {
    expect(adjacentStage('video', -1)).toBeNull()
    expect(adjacentStage('publication', 1)).toBeNull()
  })
})

describe('stageToStatus', () => {
  it('maps the 5 board stages to the persisting base status', () => {
    expect(stageToStatus('video')).toBe('grabada')
    expect(stageToStatus('edited')).toBe('producida')
    expect(stageToStatus('approval')).toBe('producida')
    expect(stageToStatus('copy')).toBe('producida')
    expect(stageToStatus('publication')).toBe('publicada')
  })
})

describe('bucketByStage', () => {
  it('groups cards into the 5 columns and preserves order', () => {
    const cards = [
      idea({ status: 'publicada' }),
      idea({ hook: 'h' }),
      idea(),
    ]
    const b = bucketByStage(cards)
    expect(b.publication).toHaveLength(1)
    expect(b.video).toHaveLength(2)
    expect(b.copy).toEqual([])
    expect(Object.keys(b)).toEqual(PIPELINE_STAGES.map((s) => s.key))
  })
})
