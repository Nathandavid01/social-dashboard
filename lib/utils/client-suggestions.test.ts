import { describe, expect, it } from 'vitest'
import {
  formatSuggestionSource,
  normalizeSuggestionInput,
  recentSuggestions,
  sortSuggestionsNewestFirst,
} from './client-suggestions'

describe('formatSuggestionSource', () => {
  it('labels known sources in Spanish', () => {
    expect(formatSuggestionSource('whatsapp')).toBe('WhatsApp')
    expect(formatSuggestionSource('mensaje')).toBe('Mensaje')
    expect(formatSuggestionSource('otro')).toBe('Otro')
  })

  it('falls back to Otro for unknown/empty', () => {
    expect(formatSuggestionSource(undefined)).toBe('Otro')
    expect(formatSuggestionSource('sms')).toBe('Otro')
  })
})

describe('normalizeSuggestionInput', () => {
  it('trims body and defaults source to whatsapp', () => {
    expect(normalizeSuggestionInput({ body: '  Hola  ' })).toEqual({
      ok: true,
      body: 'Hola',
      source: 'whatsapp',
    })
  })

  it('rejects empty body', () => {
    expect(normalizeSuggestionInput({ body: '   ' })).toEqual({
      ok: false,
      error: 'Escribe la sugerencia del cliente.',
    })
  })

  it('rejects invalid source', () => {
    expect(normalizeSuggestionInput({ body: 'x', source: 'email' })).toEqual({
      ok: false,
      error: 'Fuente no válida.',
    })
  })

  it('accepts mensaje / otro', () => {
    expect(normalizeSuggestionInput({ body: 'idea', source: 'mensaje' })).toMatchObject({
      ok: true,
      source: 'mensaje',
    })
  })
})

describe('sortSuggestionsNewestFirst / recentSuggestions', () => {
  const rows = [
    { id: 'a', created_at: '2026-01-01T00:00:00Z' },
    { id: 'b', created_at: '2026-03-01T00:00:00Z' },
    { id: 'c', created_at: '2026-02-01T00:00:00Z' },
  ]

  it('sorts newest first without mutating', () => {
    const sorted = sortSuggestionsNewestFirst(rows)
    expect(sorted.map((r) => r.id)).toEqual(['b', 'c', 'a'])
    expect(rows[0].id).toBe('a')
  })

  it('caps recent list', () => {
    expect(recentSuggestions(sortSuggestionsNewestFirst(rows), 2).map((r) => r.id)).toEqual([
      'b',
      'c',
    ])
  })
})
