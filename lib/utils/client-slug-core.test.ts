import { describe, it, expect } from 'vitest'
import { slugifyClientName, resolveClientId } from './client-slug-core'

describe('client-slug-core', () => {
  it('slugifies names (accents, symbols, spaces)', () => {
    expect(slugifyClientName('Primer Round Oficial')).toBe('primer-round-oficial')
    expect(slugifyClientName('Café Don Rogelio')).toBe('cafe-don-rogelio')
    expect(slugifyClientName('A&B / C')).toBe('a-b-c')
    expect(slugifyClientName('  ')).toBe('')
  })

  const clients = [
    { id: '11111111-1111-1111-1111-111111111111', name: 'Primer Round Oficial' },
    { id: '22222222-2222-2222-2222-222222222222', name: 'Café Don Rogelio' },
  ]

  it('resolves a raw UUID that exists', () => {
    expect(resolveClientId('11111111-1111-1111-1111-111111111111', clients)).toBe(
      '11111111-1111-1111-1111-111111111111',
    )
  })

  it('resolves a unique name slug (accent-insensitive)', () => {
    expect(resolveClientId('primer-round-oficial', clients)).toBe(clients[0].id)
    expect(resolveClientId('cafe-don-rogelio', clients)).toBe(clients[1].id)
  })

  it('returns null for an ambiguous slug', () => {
    const dup = [
      { id: 'a', name: 'Acme' },
      { id: 'b', name: 'ACME' },
    ]
    expect(resolveClientId('acme', dup)).toBeNull()
  })

  it('returns null for no match or empty', () => {
    expect(resolveClientId('nope', clients)).toBeNull()
    expect(resolveClientId('', clients)).toBeNull()
  })
})
