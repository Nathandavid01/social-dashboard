import { describe, it, expect } from 'vitest'
import { isIdeaReadyForCaption, ideaReadyMissingLabels } from './idea-ready'

describe('isIdeaReadyForCaption', () => {
  it('only needs "de qué es el video" (hook) — like the idea generator', () => {
    expect(isIdeaReadyForCaption({})).toBe(false)
    expect(isIdeaReadyForCaption({ hook: '   ' })).toBe(false)
    expect(isIdeaReadyForCaption({ hook: 'tips de uniformes para clínicas' })).toBe(true)
    // visual brief is optional detail now, never a blocker
    expect(isIdeaReadyForCaption({ visual_brief: 'v' })).toBe(false)
    expect(isIdeaReadyForCaption({ hook: 'h', visual_brief: 'v' })).toBe(true)
  })
})

describe('ideaReadyMissingLabels', () => {
  it('asks only for the topic, in plain Spanish', () => {
    expect(ideaReadyMissingLabels({})).toEqual(['de qué es el video'])
    expect(ideaReadyMissingLabels({ hook: 'h' })).toEqual([])
    expect(ideaReadyMissingLabels({ hook: 'h', visual_brief: 'v', caption_angle: 'a' })).toEqual([])
  })
})
