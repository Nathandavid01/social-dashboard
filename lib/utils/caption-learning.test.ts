import { describe, it, expect } from 'vitest'
import { selectApprovedExamples, selectAvoidExamples, mergeApprovedAndLoved, detectRecurringFeedback } from './caption-learning'

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

describe('mergeApprovedAndLoved', () => {
  const loved = ['LOVED uno con largo más que suficiente', 'LOVED dos con largo más que suficiente']
  const approved = ['APROBADO uno con largo más que suficiente', 'APROBADO dos con largo más que suficiente']

  it('puts loved FIRST (the #1 loved leads) and keeps order', () => {
    const out = mergeApprovedAndLoved(loved, approved)
    expect(out[0]).toBe(loved[0]) // the top loved must lead — regression guard for the lexicographic bug
    expect(out[1]).toBe(loved[1])
    expect(out[2]).toBe(approved[0])
  })

  it('the #1 loved survives even when the list exceeds the cap', () => {
    const manyApproved = Array.from({ length: 20 }, (_, i) => `APROBADO número ${i} con largo suficiente`)
    const out = mergeApprovedAndLoved(['LOVED líder con largo suficiente', ...[]], manyApproved, 6)
    expect(out).toHaveLength(6)
    expect(out[0]).toBe('LOVED líder con largo suficiente')
  })

  it('dedups loved vs approved (same caption rated 👍 and approved appears once)', () => {
    const dup = 'Mismo caption aprobado y con pulgar arriba, largo ok'
    const out = mergeApprovedAndLoved([dup], [dup])
    expect(out.filter((t) => t === dup)).toHaveLength(1)
  })
})

describe('detectRecurringFeedback', () => {
  it('flags a note repeated ≥2 times (case/space-insensitive), most frequent first', () => {
    const out = detectRecurringFeedback([
      'Menos emojis',
      'menos  emojis',
      'menos emojis',
      'Más llamado a la acción',
      'mas llamado a la accion', // distinct (no accent normalization) — not counted with the above
    ])
    expect(out[0]).toEqual({ phrase: 'Menos emojis', count: 3 })
  })

  it('ignores notes seen only once and blanks/too-short', () => {
    const out = detectRecurringFeedback(['único', '  ', null, 'ok'])
    expect(out).toEqual([])
  })

  it('caps the number of suggestions', () => {
    const notes = ['aaa', 'aaa', 'bbb', 'bbb', 'ccc', 'ccc', 'ddd', 'ddd']
    expect(detectRecurringFeedback(notes, { limit: 2 })).toHaveLength(2)
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
