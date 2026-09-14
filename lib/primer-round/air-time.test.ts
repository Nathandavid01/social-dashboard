import { describe, it, expect } from 'vitest'
import { applyPrimerRoundAirPhrase, primerRoundNextAirCopy } from './air-time'

/** Puerto Rico is UTC−4, no DST. */
describe('primerRoundNextAirCopy', () => {
  it('Sunday night → mañana desde las 5:43 AM (next show is Monday)', () => {
    const air = primerRoundNextAirCopy(Date.parse('2026-09-14T01:40:00Z')) // Sun 21:40 PR
    expect(air.when).toBe('mañana')
    expect(air.phrase).toBe('mañana desde las 5:43 AM')
    expect(air.phraseStart).toBe('Mañana desde las 5:43 AM')
  })

  it('Monday before 5:43 AM → hoy desde las 5:43 AM', () => {
    expect(primerRoundNextAirCopy(Date.parse('2026-09-14T08:00:00Z')).phrase).toBe(
      'hoy desde las 5:43 AM',
    )
  })

  it('Monday after the show → mañana desde las 5:43 AM', () => {
    expect(primerRoundNextAirCopy(Date.parse('2026-09-14T14:00:00Z')).phrase).toBe(
      'mañana desde las 5:43 AM',
    )
  })

  it('Friday evening or Saturday → el lunes desde las 5:43 AM', () => {
    expect(primerRoundNextAirCopy(Date.parse('2026-09-18T22:00:00Z')).phrase).toBe(
      'el lunes desde las 5:43 AM',
    )
    expect(primerRoundNextAirCopy(Date.parse('2026-09-19T16:00:00Z')).phrase).toBe(
      'el lunes desde las 5:43 AM',
    )
  })
})

describe('applyPrimerRoundAirPhrase', () => {
  const stale =
    'LA NOTICIA NO ESPERA\n\nLA NOTICIA NO ESPERA hoy en Primer Round junto a Dennise Pérez y Rafael Lenín.\n\n#magic973 #puertorico #primerround'

  it('Sunday posted today rewrites hoy → mañana desde las 5:43 AM', () => {
    const air = primerRoundNextAirCopy(Date.parse('2026-09-14T01:40:00Z'))
    const next = applyPrimerRoundAirPhrase(stale, air)
    expect(next).toContain('mañana desde las 5:43 AM junto a Dennise Pérez y Rafael Lenín')
    expect(next).not.toMatch(/hoy en Primer Round/)
  })

  it('weekday morning keeps hoy desde las 5:43 AM', () => {
    const air = primerRoundNextAirCopy(Date.parse('2026-09-14T08:00:00Z'))
    expect(applyPrimerRoundAirPhrase(stale, air)).toContain('hoy desde las 5:43 AM junto a')
  })
})
