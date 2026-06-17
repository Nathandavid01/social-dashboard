import { describe, it, expect } from 'vitest'
import { isIdeaReadyForCaption, ideaReadyMissingLabels } from './idea-ready'

describe('isIdeaReadyForCaption', () => {
  it('requires hook and visual brief', () => {
    expect(isIdeaReadyForCaption({})).toBe(false)
    expect(isIdeaReadyForCaption({ hook: 'h' })).toBe(false)
    expect(isIdeaReadyForCaption({ visual_brief: 'v' })).toBe(false)
    expect(isIdeaReadyForCaption({ hook: 'h', visual_brief: 'v' })).toBe(true)
  })
})

describe('ideaReadyMissingLabels', () => {
  it('lists missing idea fields in Spanish', () => {
    expect(ideaReadyMissingLabels({})).toEqual(['hook', 'brief visual', 'ángulo del caption'])
    expect(ideaReadyMissingLabels({ hook: 'h', visual_brief: 'v', caption_angle: 'a' })).toEqual([])
  })
})
