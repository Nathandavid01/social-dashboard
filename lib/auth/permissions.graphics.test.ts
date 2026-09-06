import { describe, it, expect } from 'vitest'
import { hasPermission } from './permissions'
import { AREAS } from './areas'

/**
 * Gráficas IA (/graficas): generar artes con Grok Imagine usando la marca del
 * cliente. Es trabajo de diseño — diseñador y supervisor lo usan (owner por
 * wildcard); los demás roles no lo necesitan (least privilege).
 */
describe('graphics.generate', () => {
  it('owner, supervisor y diseñador pueden generar gráficas', () => {
    expect(hasPermission('owner', 'graphics.generate')).toBe(true)
    expect(hasPermission('supervisor', 'graphics.generate')).toBe(true)
    expect(hasPermission('disenador', 'graphics.generate')).toBe(true)
  })

  it('editor, video, copy y legacy no', () => {
    expect(hasPermission('editor', 'graphics.generate')).toBe(false)
    expect(hasPermission('video', 'graphics.generate')).toBe(false)
    expect(hasPermission('copy', 'graphics.generate')).toBe(false)
    expect(hasPermission('team_member', 'graphics.generate')).toBe(false)
  })

  it('/graficas está registrada como área de Marketing con esa permission', () => {
    const area = AREAS.find((a) => a.href === '/graficas')
    expect(area).toBeDefined()
    expect(area?.permission).toBe('graphics.generate')
    expect(area?.group).toBe('Marketing')
    expect(area?.nav).not.toBe(false)
  })
})
