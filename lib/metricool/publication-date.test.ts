import { describe, it, expect } from 'vitest'
import { publicationDay, publicationInstant } from './publication-date'

describe('publicationInstant', () => {
  it('convierte hora de pared + zona de Metricool a un instante UTC', () => {
    // Post real de Arecibo Lab: 13:59 en America/Chicago (CDT, UTC-5).
    expect(publicationInstant({ dateTime: '2026-09-24T13:59:00', timezone: 'America/Chicago' })).toBe('2026-09-24T18:59:00.000Z')
    expect(publicationInstant({ dateTime: '2026-09-24T13:59:00', timezone: 'America/Puerto_Rico' })).toBe('2026-09-24T17:59:00.000Z')
  })

  it('respeta un timestamp absoluto', () => {
    expect(publicationInstant({ dateTime: '2026-09-24T13:59:00Z', timezone: 'America/Chicago' })).toBe('2026-09-24T13:59:00.000Z')
  })

  it('sin zona usa la de Puerto Rico; basura o vacío da null', () => {
    expect(publicationInstant({ dateTime: '2026-09-24T08:00:00', timezone: '' })).toBe('2026-09-24T12:00:00.000Z')
    expect(publicationInstant({ dateTime: 'ayer', timezone: 'America/Chicago' })).toBeNull()
    expect(publicationInstant(undefined)).toBeNull()
  })
})

describe('publicationDay', () => {
  it('sigue dando el día de Puerto Rico', () => {
    expect(publicationDay({ dateTime: '2026-09-24T23:30:00', timezone: 'America/Chicago' })).toBe('2026-09-25')
    expect(publicationDay({ dateTime: '2026-09-24T13:59:00', timezone: 'America/Chicago' })).toBe('2026-09-24')
  })
})
