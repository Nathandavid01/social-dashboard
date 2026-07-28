import { describe, it, expect } from 'vitest'
import { visibleEntregaStages, canSeeEntregaStage } from './visible-stages'

describe('visibleEntregaStages', () => {
  it('owner y supervisor ven las cuatro columnas', () => {
    for (const r of ['owner', 'supervisor'] as const) {
      expect(visibleEntregaStages(r)).toEqual(['edited', 'approval', 'copy', 'publication'])
    }
  })

  it('editor y diseñador solo ven Editado y Revisión', () => {
    for (const r of ['editor', 'disenador'] as const) {
      expect(visibleEntregaStages(r)).toEqual(['edited', 'approval'])
      expect(canSeeEntregaStage(r, 'copy')).toBe(false)
      expect(canSeeEntregaStage(r, 'publication')).toBe(false)
    }
  })

  it('el editor SÍ ve Revisión: ahí está lo que le devolvieron', () => {
    expect(canSeeEntregaStage('editor', 'approval')).toBe(true)
  })

  it('el videógrafo no entra a Entregas, así que no ve ninguna', () => {
    expect(visibleEntregaStages('video')).toEqual([])
  })

  it('sin rol no se ve nada — falla cerrado', () => {
    expect(visibleEntregaStages(null)).toEqual([])
    expect(visibleEntregaStages(undefined)).toEqual([])
    expect(canSeeEntregaStage(null, 'edited')).toBe(false)
  })

  it('un rol desconocido tampoco abre el tablero', () => {
    expect(visibleEntregaStages('team_member')).toEqual([])
  })
})
