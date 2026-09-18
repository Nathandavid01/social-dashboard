import { describe, it, expect } from 'vitest'
import { hasPermission } from './permissions'
import { AREAS } from './areas'

/**
 * Primer Round (/primer-round): el editor sube, la IA arma el caption y se
 * manda un BORRADOR a Metricool. No es posting.publish (eso sigue siendo
 * owner/supervisor). Least privilege: no video, no diseñador, no copy.
 */
describe('metricool.draft', () => {
  it('owner, supervisor y editor pueden crear el borrador', () => {
    expect(hasPermission('owner', 'metricool.draft')).toBe(true)
    expect(hasPermission('supervisor', 'metricool.draft')).toBe(true)
    expect(hasPermission('editor', 'metricool.draft')).toBe(true)
  })

  it('video, diseñador, copy y legacy no', () => {
    expect(hasPermission('video', 'metricool.draft')).toBe(false)
    expect(hasPermission('disenador', 'metricool.draft')).toBe(false)
    expect(hasPermission('copy', 'metricool.draft')).toBe(false)
    expect(hasPermission('team_member', 'metricool.draft')).toBe(false)
  })

  it('el editor sigue sin poder publicar en vivo', () => {
    expect(hasPermission('editor', 'posting.publish')).toBe(false)
    expect(hasPermission('editor', 'metricool.write')).toBe(false)
  })

  it('/primer-round es el área de Trabajo; metricool.draft no abre una pantalla aparte', () => {
    const area = AREAS.find((a) => a.href === '/primer-round')
    expect(area).toBeDefined()
    expect(area?.label).toBe('Primer Round')
    expect(area?.group).toBe('Trabajo')
    expect(AREAS.find((a) => a.href === '/subir-video')).toBeUndefined()
  })
})
