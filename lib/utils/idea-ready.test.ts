import { describe, it, expect } from 'vitest'
import {
  hasCaptionableVideo,
  isIdeaReadyForCaption,
  ideaReadyMissingLabels,
  shouldAutoDraftCaption,
} from './idea-ready'

describe('hasCaptionableVideo', () => {
  it('is true when there is at least one non-archived video', () => {
    expect(hasCaptionableVideo([])).toBe(false)
    expect(hasCaptionableVideo([{ status: 'archived' }])).toBe(false)
    expect(hasCaptionableVideo([{ status: 'uploaded' }])).toBe(true)
    expect(hasCaptionableVideo([{ status: 'uploaded' }, { status: 'archived' }])).toBe(true)
  })
})

describe('isIdeaReadyForCaption', () => {
  it('needs the topic AND a video — no caption without footage', () => {
    expect(isIdeaReadyForCaption({})).toBe(false)
    expect(isIdeaReadyForCaption({ hook: 'tips' })).toBe(false)
    expect(isIdeaReadyForCaption({ hook: 'tips', hasVideo: false })).toBe(false)
    expect(isIdeaReadyForCaption({ hook: 'tips', hasVideo: true })).toBe(true)
    expect(isIdeaReadyForCaption({ hook: '   ', hasVideo: true })).toBe(false)
    expect(isIdeaReadyForCaption({ visual_brief: 'v', hasVideo: true })).toBe(false)
  })

  it('el análisis visual de la IA reemplaza el hook cuando ya vio el video', () => {
    // Sin hook + con análisis visual + video → listo (Eric: el hook queda para uso manual).
    expect(isIdeaReadyForCaption({ hasVideo: true, hasVisualAnalysis: true })).toBe(true)
    // Sin hook + sin análisis → sigue sin estar listo, como hoy.
    expect(isIdeaReadyForCaption({ hasVideo: true, hasVisualAnalysis: false })).toBe(false)
    expect(isIdeaReadyForCaption({ hasVideo: true })).toBe(false)
    // Con hook + sin análisis → listo, comportamiento de siempre.
    expect(isIdeaReadyForCaption({ hook: 'tips', hasVideo: true, hasVisualAnalysis: false })).toBe(true)
    // Sin video, aunque haya análisis, nunca está listo.
    expect(isIdeaReadyForCaption({ hasVisualAnalysis: true })).toBe(false)
    expect(isIdeaReadyForCaption({ hasVideo: false, hasVisualAnalysis: true })).toBe(false)
  })
})

describe('ideaReadyMissingLabels', () => {
  it('asks for the topic and the video, in plain Spanish', () => {
    expect(ideaReadyMissingLabels({})).toEqual(['de qué es el video', 'el video'])
    expect(ideaReadyMissingLabels({ hook: 'h' })).toEqual(['el video'])
    expect(ideaReadyMissingLabels({ hook: 'h', hasVideo: true })).toEqual([])
    expect(ideaReadyMissingLabels({ hasVideo: true })).toEqual(['de qué es el video'])
  })

  it('no pide el hook cuando ya hay análisis visual, pero sigue pidiéndolo sin él', () => {
    expect(ideaReadyMissingLabels({ hasVideo: true, hasVisualAnalysis: true })).toEqual([])
    expect(ideaReadyMissingLabels({ hasVideo: true, hasVisualAnalysis: false })).toEqual(['de qué es el video'])
    expect(ideaReadyMissingLabels({ hasVisualAnalysis: true })).toEqual(['el video'])
  })
})

describe('shouldAutoDraftCaption', () => {
  it('is true only when there is hook + video and no caption yet', () => {
    expect(shouldAutoDraftCaption({ hook: 'tips', hasVideo: true })).toBe(true)
    expect(shouldAutoDraftCaption({ hook: 'tips' })).toBe(false)
    expect(shouldAutoDraftCaption({ hook: 'tips', hasVideo: true, caption_draft: 'ya hay draft' })).toBe(false)
    expect(shouldAutoDraftCaption({ hook: 'tips', hasVideo: true, generated_caption: 'ya aprobado' })).toBe(false)
    expect(shouldAutoDraftCaption({ hook: '', hasVideo: true })).toBe(false)
  })
})
