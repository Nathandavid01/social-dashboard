import { describe, it, expect } from 'vitest'
import { selectApprovedExamples, selectAvoidExamples } from './caption-learning'

describe('selectApprovedExamples', () => {
  it('returns [] for no rows', () => {
    expect(selectApprovedExamples([])).toEqual([])
  })

  it('keeps approved captions, newest first', () => {
    const out = selectApprovedExamples([
      { text: 'Caption viejo que ya rinde bien en redes', recency: '2026-05-01' },
      { text: 'Caption nuevo y aprobado por el equipo hoy', recency: '2026-06-10' },
    ])
    expect(out[0]).toContain('nuevo y aprobado')
    expect(out[1]).toContain('viejo')
  })

  it('drops blanks and very-short strings (< 20 chars)', () => {
    const out = selectApprovedExamples([
      { text: '   ', recency: '2026-06-01' },
      { text: 'corto', recency: '2026-06-02' },
      { text: 'Este caption sí es suficientemente largo y válido', recency: '2026-06-03' },
    ])
    expect(out).toEqual(['Este caption sí es suficientemente largo y válido'])
  })

  it('dedups case- and whitespace-insensitively', () => {
    const out = selectApprovedExamples([
      { text: 'Tu sofá como nuevo, agenda hoy mismo ✨', recency: '2026-06-02' },
      { text: 'tu sofá  como nuevo,  agenda hoy mismo ✨', recency: '2026-06-01' },
    ])
    expect(out).toHaveLength(1)
  })

  it('caps at the limit (default 6)', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      text: `Caption aprobado número ${i} con largo suficiente`,
      recency: `2026-06-${String(i + 1).padStart(2, '0')}`,
    }))
    expect(selectApprovedExamples(rows)).toHaveLength(6)
    expect(selectApprovedExamples(rows, 3)).toHaveLength(3)
  })
})

describe('selectAvoidExamples', () => {
  it('returns rejected captions with their note, newest first, capped at 4', () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({
      text: `Caption rechazado número ${i} con largo suficiente`,
      note: i % 2 ? 'demasiados emojis' : null,
      recency: `2026-06-${String(i + 1).padStart(2, '0')}`,
    }))
    const out = selectAvoidExamples(rows)
    expect(out).toHaveLength(4)
    expect(out[0].text).toContain('número 5') // newest
    expect(out[0].note).toBe('demasiados emojis')
  })

  it('drops blanks/short and dedups, normalizing empty notes to null', () => {
    const out = selectAvoidExamples([
      { text: 'corto', note: 'x' },
      { text: 'Caption rechazado válido y suficientemente largo', note: '   ' },
      { text: 'caption rechazado  válido y suficientemente largo', note: 'dup' },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].note).toBeNull()
  })
})
