import { describe, it, expect } from 'vitest'
import { qcSaysItIsTheClients } from './qc-gate'

describe('qcSaysItIsTheClients', () => {
  it('ok → sí', () => {
    expect(qcSaysItIsTheClients({ relevance: { verdict: 'ok', explanation: '' } })).toBe(true)
  })
  it('warning → no (no se genera caption ni se escribe el hook)', () => {
    expect(qcSaysItIsTheClients({ relevance: { verdict: 'warning', explanation: 'otro negocio' } })).toBe(false)
  })
  it('sin veredicto (respuesta vieja) → deja pasar', () => {
    expect(qcSaysItIsTheClients({ relevance: undefined as never })).toBe(true)
    expect(qcSaysItIsTheClients(null)).toBe(true)
  })
})
