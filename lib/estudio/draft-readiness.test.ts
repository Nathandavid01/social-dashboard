import { describe, it, expect } from 'vitest'
import { editorStudioDraftReadiness, pickStudioCaption } from './draft-readiness'

const base = {
  status: 'producida',
  published_at: null,
  metricool_post_id: null,
  posted_at: null,
  caption: 'Hoy en Primer Round junto a Rafael Lenín López y Dennise Pérez.',
}

describe('editorStudioDraftReadiness', () => {
  it('allows a pending piece with caption + video + blog — no approval required', () => {
    expect(editorStudioDraftReadiness(base, true, '5476146')).toEqual({ ready: true })
  })

  it('blocks already-posted, missing caption, missing video, missing blog', () => {
    expect(editorStudioDraftReadiness({ ...base, metricool_post_id: 9 }, true, '5476146').reason).toMatch(
      /Metricool/,
    )
    expect(editorStudioDraftReadiness({ ...base, caption: '  ' }, true, '5476146').reason).toMatch(/caption/)
    expect(editorStudioDraftReadiness(base, false, '5476146').reason).toMatch(/video/)
    expect(editorStudioDraftReadiness(base, true, '').reason).toMatch(/blog_id/)
  })

  it('does not require approval_status', () => {
    const ready = editorStudioDraftReadiness(base, true, 'blog')
    expect(ready.ready).toBe(true)
    expect(JSON.stringify(ready)).not.toMatch(/aprobad/i)
  })
})

describe('pickStudioCaption', () => {
  it('prefers the editor override, then generated, then draft', () => {
    expect(pickStudioCaption('gen', 'draft', 'override')).toBe('override')
    expect(pickStudioCaption('gen', 'draft', '  ')).toBe('gen')
    expect(pickStudioCaption(null, 'draft', null)).toBe('draft')
  })
})
