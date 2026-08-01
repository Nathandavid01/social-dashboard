import { describe, it, expect } from 'vitest'
import { latestNoteByIdea, type ReviewNoteRow } from './review-notes-core'

const fila = (over: Partial<ReviewNoteRow> & { content_idea_id: string }): ReviewNoteRow => ({
  metadata: { note: 'texto' },
  created_at: '2026-07-30T10:00:00Z',
  user: null,
  ...over,
})

describe('latestNoteByIdea', () => {
  it('devuelve la nota de cada video', () => {
    const m = latestNoteByIdea([fila({ content_idea_id: 'a', metadata: { note: 'Corta el inicio' } })])
    expect(m.a.note).toBe('Corta el inicio')
  })

  // Un video puede volver de revisión varias veces; lo que el editor tiene que
  // leer es lo último que le pidieron, no la primera ronda.
  it('con varias rondas se queda con la más reciente', () => {
    const m = latestNoteByIdea([
      fila({ content_idea_id: 'a', metadata: { note: 'vieja' }, created_at: '2026-07-01T10:00:00Z' }),
      fila({ content_idea_id: 'a', metadata: { note: 'nueva' }, created_at: '2026-07-30T10:00:00Z' }),
    ])
    expect(m.a.note).toBe('nueva')
  })

  it('no mezcla notas entre videos', () => {
    const m = latestNoteByIdea([
      fila({ content_idea_id: 'a', metadata: { note: 'de A' } }),
      fila({ content_idea_id: 'b', metadata: { note: 'de B' } }),
    ])
    expect(m.a.note).toBe('de A')
    expect(m.b.note).toBe('de B')
  })

  it('guarda quién lo pidió, para saber a quién preguntar', () => {
    const m = latestNoteByIdea([
      fila({ content_idea_id: 'a', user: { full_name: 'Tuti' } }),
    ])
    expect(m.a.author).toBe('Tuti')
  })

  it('sin autor no rompe', () => {
    expect(latestNoteByIdea([fila({ content_idea_id: 'a', user: null })]).a.author).toBeNull()
  })

  it('una fila sin texto se ignora — no queremos una caja vacía en la tarjeta', () => {
    expect(latestNoteByIdea([fila({ content_idea_id: 'a', metadata: {} })])).toEqual({})
    expect(latestNoteByIdea([fila({ content_idea_id: 'a', metadata: { note: '   ' } })])).toEqual({})
  })

  it('sin filas devuelve un mapa vacío', () => {
    expect(latestNoteByIdea([])).toEqual({})
  })
})

describe('correcciones que vienen del cliente', () => {
  it('el nombre del cliente sale de metadata, no de profiles', () => {
    const m = latestNoteByIdea([{
      content_idea_id: 'a',
      metadata: { note: 'Cortar el logo', cliente: 'La Guarapera' },
      created_at: '2026-08-01T10:00:00Z',
      user: null,
    }])
    expect(m.a.author).toBe('La Guarapera')
    expect(m.a.note).toBe('Cortar el logo')
  })

  it('si la pidió el equipo, sigue saliendo el nombre del perfil', () => {
    const m = latestNoteByIdea([{
      content_idea_id: 'a',
      metadata: { note: 'Subir la música' },
      created_at: '2026-08-01T10:00:00Z',
      user: { full_name: 'Tuti' },
    }])
    expect(m.a.author).toBe('Tuti')
  })
})
