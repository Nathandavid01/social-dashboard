import { describe, it, expect } from 'vitest'
import { WIZARD_STEPS, wizardProgress, canCreateClient, nextStepKey, prevStepKey } from './client-wizard'

describe('client wizard step model', () => {
  it('starts with datos (required) and ends with listo', () => {
    expect(WIZARD_STEPS[0].key).toBe('datos')
    expect(WIZARD_STEPS[0].optional).toBe(false)
    expect(WIZARD_STEPS[WIZARD_STEPS.length - 1].key).toBe('listo')
  })

  it('middle steps are skippable', () => {
    for (const k of ['metricool', 'cadencia', 'voz'] as const) {
      expect(WIZARD_STEPS.find((s) => s.key === k)?.optional).toBe(true)
    }
  })

  it('progress goes 0% on the first step to 100% on the last', () => {
    expect(wizardProgress('datos')).toMatchObject({ stepNumber: 1, total: 5, pct: 0 })
    expect(wizardProgress('listo')).toMatchObject({ stepNumber: 5, total: 5, pct: 100 })
    expect(wizardProgress('cadencia').stepNumber).toBe(3)
  })

  it('canCreateClient requires a name and ≥1 platform', () => {
    expect(canCreateClient({ name: 'Acme', platforms: ['instagram'] })).toBe(true)
    expect(canCreateClient({ name: '  ', platforms: ['instagram'] })).toBe(false)
    expect(canCreateClient({ name: 'Acme', platforms: [] })).toBe(false)
    expect(canCreateClient({ name: 'Acme', platforms: null })).toBe(false)
  })

  it('nextStepKey walks the sequence and stops at the end', () => {
    expect(nextStepKey('datos')).toBe('metricool')
    expect(nextStepKey('voz')).toBe('listo')
    expect(nextStepKey('listo')).toBeNull()
  })

  it('prevStepKey walks backwards and stops at the start', () => {
    expect(prevStepKey('metricool')).toBe('datos')
    expect(prevStepKey('listo')).toBe('voz')
    expect(prevStepKey('datos')).toBeNull()
  })
})
