import { describe, it, expect } from 'vitest'
import { isIdeaReadyForCaption, ideaReadyMissingLabels, shouldAutoDraftCaption } from './idea-ready'

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

describe('shouldAutoDraftCaption', () => {
  it('is true only when the idea has a hook and no caption yet', () => {
    expect(shouldAutoDraftCaption({ hook: 'tips' })).toBe(true)
    expect(shouldAutoDraftCaption({ hook: 'tips', caption_draft: 'ya hay draft' })).toBe(false)
    expect(shouldAutoDraftCaption({ hook: 'tips', generated_caption: 'ya aprobado' })).toBe(false)
    expect(shouldAutoDraftCaption({ hook: '' })).toBe(false)
  })
})
