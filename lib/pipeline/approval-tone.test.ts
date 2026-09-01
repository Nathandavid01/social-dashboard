import { describe, expect, it } from 'vitest'
import { approvalTone } from './approval-tone'

/**
 * Las aprobaciones van por colores: verde (≥90), amarillo (75–89), rojo (<75).
 * Sin historial → neutro (sin color que asuste a un editor nuevo).
 */
describe('approvalTone', () => {
  it('≥90 es verde, incluyendo el borde exacto', () => {
    expect(approvalTone(95).tone).toBe('verde')
    expect(approvalTone(90).tone).toBe('verde')
  })
  it('75–89 es amarillo (bordes incluidos)', () => {
    expect(approvalTone(89).tone).toBe('amarillo')
    expect(approvalTone(75).tone).toBe('amarillo')
  })
  it('<75 es rojo, incluso 0', () => {
    expect(approvalTone(74).tone).toBe('rojo')
    expect(approvalTone(0).tone).toBe('rojo')
  })
  it('null (sin historial) es neutro', () => {
    expect(approvalTone(null).tone).toBe('neutro')
  })
})
