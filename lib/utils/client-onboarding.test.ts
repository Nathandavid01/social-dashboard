import { describe, it, expect } from 'vitest'
import { clientOnboardingStatus } from './client-onboarding'

describe('clientOnboardingStatus', () => {
  it('flags everything pending for a brand-new client', () => {
    const s = clientOnboardingStatus({ status: 'onboarding' })
    expect(s.doneCount).toBe(0)
    expect(s.total).toBe(5)
    expect(s.complete).toBe(false)
    expect(s.automatable).toBe(false)
  })

  it('marks the 3 required items and reports automatable when they are set', () => {
    const s = clientOnboardingStatus({
      status: 'active',
      metricool_blog_id: '5062650',
      posting_days: [1, 3, 5],
    })
    expect(s.automatable).toBe(true) // active + metricool + cadence
    expect(s.complete).toBe(false) // voice + first video still pending
    const byKey = Object.fromEntries(s.items.map((i) => [i.key, i.done]))
    expect(byKey.active).toBe(true)
    expect(byKey.metricool).toBe(true)
    expect(byKey.cadence).toBe(true)
    expect(byKey.voice).toBe(false)
    expect(byKey.firstVideo).toBe(false)
  })

  it('is complete only when all five are satisfied', () => {
    const s = clientOnboardingStatus({
      status: 'active',
      metricool_blog_id: 'x',
      posting_days: [2],
      brand_voice: 'Cercano y juvenil',
      hasVideos: true,
    })
    expect(s.doneCount).toBe(5)
    expect(s.complete).toBe(true)
    expect(s.automatable).toBe(true)
  })

  it('treats blank/whitespace metricool id and voice as not done', () => {
    const s = clientOnboardingStatus({ status: 'active', metricool_blog_id: '  ', brand_voice: '' })
    const byKey = Object.fromEntries(s.items.map((i) => [i.key, i.done]))
    expect(byKey.metricool).toBe(false)
    expect(byKey.voice).toBe(false)
  })

  it('required items are active, metricool and cadence', () => {
    const required = clientOnboardingStatus({}).items.filter((i) => i.required).map((i) => i.key)
    expect(required).toEqual(['active', 'metricool', 'cadence'])
  })
})
