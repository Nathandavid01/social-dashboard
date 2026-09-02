import { describe, it, expect } from 'vitest'
import { approvalTarget, approvalTargetText, formatApprovalAt } from './approval-target'

describe('approvalTarget — "aprobado para las ___"', () => {
  it('publicación menos 24 h a la hora del cliente', () => {
    // 2026-09-03 es jueves; el cliente postea a las 10:00.
    const t = approvalTarget({ publishDate: '2026-09-03', postingTime: '10:00' })
    expect(t).toEqual({ at: '2026-09-02T10:00', basis: 'publish', publishAt: '2026-09-03T10:00' })
  })
  it('respeta el horario por día (posting_schedule) y el margen configurable', () => {
    const t = approvalTarget({ publishDate: '2026-09-03', postingTime: '10:00', postingSchedule: { '4': '18:30' }, reviewBufferHours: 48 })
    expect(t?.at).toBe('2026-09-01T18:30')
    expect(t?.publishAt).toBe('2026-09-03T18:30')
  })
  it('sin hora configurada asume 10:00', () => {
    expect(approvalTarget({ publishDate: '2026-09-03' })?.at).toBe('2026-09-02T10:00')
  })
  it('una fecha límite más temprana gana', () => {
    const t = approvalTarget({ publishDate: '2026-09-10', postingTime: '10:00', deadline: '2026-09-04' })
    expect(t).toEqual({ at: '2026-09-04T17:00', basis: 'deadline', publishAt: '2026-09-10T10:00' })
  })
  it('sin fecha de publicación ni límite → null, y el texto lo dice', () => {
    expect(approvalTarget({ publishDate: null })).toBeNull()
    expect(approvalTargetText(null)).toMatch(/Sin fecha de publicación/)
  })
  it('texto legible en español', () => {
    expect(formatApprovalAt('2026-09-02T10:00')).toBe('mié 2 sep · 10:00 a. m.')
    expect(formatApprovalAt('2026-09-01T18:30')).toBe('mar 1 sep · 6:30 p. m.')
    expect(approvalTargetText({ at: '2026-09-02T10:00', basis: 'publish', publishAt: '2026-09-03T10:00' }))
      .toBe('Aprobado para mié 2 sep · 10:00 a. m. · publica jue 3 sep · 10:00 a. m.')
    expect(approvalTargetText({ at: '2026-09-04T17:00', basis: 'deadline', publishAt: null })).toBe('Aprobado para vie 4 sep · 5:00 p. m. (fecha límite)')
  })
})
