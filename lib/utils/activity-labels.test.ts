import { describe, it, expect } from 'vitest'
import { activityVerb, ACTION_META } from './activity-labels'

describe('activityVerb', () => {
  it('returns the Spanish phrase for each known action', () => {
    expect(activityVerb('recorded')).toBe('grabó el video')
    expect(activityVerb('caption_saved')).toBe('editó el caption')
    expect(activityVerb('published')).toBe('marcó como publicado')
    expect(activityVerb('assigned')).toBe('asignó a producción')
  })

  it('weaves metadata into the phrase', () => {
    expect(activityVerb('caption_generated', { platform: 'instagram' })).toBe(
      'generó el caption con IA (instagram)',
    )
    expect(activityVerb('video_uploaded', { kind: 'edited' })).toBe('subió video (edited)')
    expect(activityVerb('status_changed', { status: 'grabada' })).toBe('cambió el estado a “grabada”')
    expect(activityVerb('posted_to_metricool', { platforms: ['ig', 'tt'] })).toBe(
      'publicó en Metricool (ig, tt)',
    )
  })

  it('omits optional metadata cleanly', () => {
    expect(activityVerb('caption_generated')).toBe('generó el caption con IA')
    expect(activityVerb('video_uploaded')).toBe('subió video')
    expect(activityVerb('status_changed')).toBe('cambió el estado')
  })

  it('falls back for an unknown action', () => {
    // @ts-expect-error — exercising the runtime fallback
    expect(activityVerb('nope')).toBe('realizó una acción')
  })

  it('has metadata for every documented action', () => {
    for (const a of [
      'recorded',
      'caption_generated',
      'caption_saved',
      'video_uploaded',
      'published',
      'posted_to_metricool',
      'assigned',
      'status_changed',
    ] as const) {
      expect(ACTION_META[a]).toBeDefined()
      expect(ACTION_META[a].tone).toMatch(/^text-/)
    }
  })
})
