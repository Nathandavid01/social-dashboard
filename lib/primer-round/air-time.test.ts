import { describe, it, expect } from 'vitest'
import { applyPrimerRoundAirPhrase, primerRoundNextAirCopy } from './air-time'

/** Puerto Rico is UTC−4, no DST. */
describe('primerRoundNextAirCopy', () => {
  it('Sunday night → mañana a las 5:43am (next show is Monday)', () => {
    const air = primerRoundNextAirCopy(Date.parse('2026-09-14T01:40:00Z')) // Sun 21:40 PR
    expect(air.when).toBe('mañana')
    expect(air.phrase).toBe('mañana a las 5:43am')
  })

  it('Monday before 5:43am → hoy a las 5:43am', () => {
    expect(primerRoundNextAirCopy(Date.parse('2026-09-14T08:00:00Z')).phrase).toBe('hoy a las 5:43am')
  })

  it('Monday after the show → mañana a las 5:43am', () => {
    expect(primerRoundNextAirCopy(Date.parse('2026-09-14T14:00:00Z')).phrase).toBe('mañana a las 5:43am')
  })

  it('Friday evening or Saturday → el lunes a las 5:43am', () => {
    expect(primerRoundNextAirCopy(Date.parse('2026-09-18T22:00:00Z')).phrase).toBe('el lunes a las 5:43am')
    expect(primerRoundNextAirCopy(Date.parse('2026-09-19T16:00:00Z')).phrase).toBe('el lunes a las 5:43am')
  })
})

describe('applyPrimerRoundAirPhrase', () => {
  const stale =
    'LA NOTICIA NO ESPERA\n\nLA NOTICIA NO ESPERA hoy en Primer Round junto a Dennise Pérez y Rafael Lenín.\n\n#magic973 #puertorico #primerround'

  it('Sunday posted today rewrites hoy → mañana a las 5:43am', () => {
    const air = primerRoundNextAirCopy(Date.parse('2026-09-14T01:40:00Z'))
    const next = applyPrimerRoundAirPhrase(stale, air)
    expect(next).toContain('mañana a las 5:43am en Primer Round junto a Dennise Pérez y Rafael Lenín')
    expect(next).not.toMatch(/hoy en Primer Round/)
  })

  it('weekday morning keeps hoy a las 5:43am', () => {
    const air = primerRoundNextAirCopy(Date.parse('2026-09-14T08:00:00Z'))
    expect(applyPrimerRoundAirPhrase(stale, air)).toContain('hoy a las 5:43am en Primer Round')
  })
})
