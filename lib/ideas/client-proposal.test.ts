import { describe, expect, it } from 'vitest'
import { proposalSnapshot, validateDecision } from './client-proposal'
describe('propuesta para aprobación del cliente', () => {
  it('conserva el contenido exacto sin notas ni puntuación internas', () => {
    const original = { id: 'i1', title: '¿Otro cafecito?', hook: 'Texto original', visualBrief: null, referenceUrl: null, shootingNotes: 'No enviar', viralityScore: 9 }
    const snapshot = proposalSnapshot([original])
    original.hook = 'Editado después'
    expect(snapshot).toEqual([{ id: 'i1', title: '¿Otro cafecito?', hook: 'Texto original', visualBrief: null, referenceUrl: null }])
  })
  it('acepta aprobar o rechazar, y limita comentarios', () => {
    expect(validateDecision('approved', 'Me gusta')).toBe(true)
    expect(validateDecision('rejected', 'Cambiar el plato')).toBe(true)
    expect(validateDecision('published', '')).toBe(false)
    expect(validateDecision('approved', 'x'.repeat(3001))).toBe(false)
  })
})
