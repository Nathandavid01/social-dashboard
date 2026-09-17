import { describe, it, expect } from 'vitest'
import { hasPermission } from './permissions'
import { AREAS } from './areas'

/**
 * Subir video (/subir-video): el editor sube, la IA arma el caption y se
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

  it('/subir-video está registrada como área de Trabajo con esa permission', () => {
    const area = AREAS.find((a) => a.href === '/subir-video')
    expect(area).toBeDefined()
    expect(area?.permission).toBe('metricool.draft')
    expect(area?.group).toBe('Trabajo')
    expect(area?.nav).not.toBe(false)
  })
})
