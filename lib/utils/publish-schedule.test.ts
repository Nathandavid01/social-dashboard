import { describe, it, expect } from 'vitest'
import { publishSchedule } from './publish-schedule'

// 2026-07-27 is a Monday.
const NOW = Date.parse('2026-07-27T12:00:00Z')

describe('publishSchedule — lo que REALMENTE se le manda a Metricool', () => {
  it('usa la fecha planificada con la hora del cliente', () => {
    const s = publishSchedule('2026-07-30', '14:30', NOW)
    expect(s.label).toBe('Jue 30 jul 2026 · 14:30')
    expect(s.iso).toBe('2026-07-30T14:30:00')
    expect(s.clamped).toBe(false)
  })

  it('sin hora del cliente cae a las 10:00', () => {
    expect(publishSchedule('2026-07-30', null, NOW).label).toBe('Jue 30 jul 2026 · 10:00')
  })

  it('hoy todavía cuenta como válido', () => {
    const s = publishSchedule('2026-07-27', '09:00', NOW)
    expect(s.clamped).toBe(false)
    expect(s.label).toBe('Lun 27 jul 2026 · 09:00')
  })

  it('una fecha PASADA se corre a +24h y lo dice', () => {
    const s = publishSchedule('2026-07-01', '10:00', NOW)
    expect(s.clamped).toBe(true)
    expect(s.label).toBe('Mar 28 jul 2026 · 12:00')
  })

  it('sin fecha planificada también se corre a +24h', () => {
    const s = publishSchedule(null, '10:00', NOW)
    expect(s.clamped).toBe(true)
    expect(s.label).toMatch(/^Mar 28 jul 2026/)
  })

  it('cubre los 7 días de la semana', () => {
    const dias = ['2026-07-27', '2026-07-28', '2026-07-29', '2026-07-30', '2026-07-31', '2026-08-01', '2026-08-02']
      .map((d) => publishSchedule(d, '10:00', NOW).label.slice(0, 3))
    expect(dias).toEqual(['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'])
  })
})
