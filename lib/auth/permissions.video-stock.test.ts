import { describe, expect, it } from 'vitest'
import { hasPermission } from './permissions'
import { areaForPath } from './areas'

/**
 * Inventario de video (/inventario): qué clientes tienen grabaciones y cuántos
 * videos editados les quedan. Lo planifican admins y el videógrafo (decide a
 * quién grabar); editor, diseño y copy no lo necesitan.
 */
describe('video_stock.read', () => {
  it('owner, supervisor y videógrafo ven el inventario', () => {
    expect(hasPermission('owner', 'video_stock.read')).toBe(true)
    expect(hasPermission('supervisor', 'video_stock.read')).toBe(true)
    expect(hasPermission('video', 'video_stock.read')).toBe(true)
  })

  it('editor, diseñador, copy y legacy team_member NO', () => {
    expect(hasPermission('editor', 'video_stock.read')).toBe(false)
    expect(hasPermission('disenador', 'video_stock.read')).toBe(false)
    expect(hasPermission('copy', 'video_stock.read')).toBe(false)
    expect(hasPermission('team_member', 'video_stock.read')).toBe(false)
    expect(hasPermission(null, 'video_stock.read')).toBe(false)
  })

  it('la ruta /inventario está gateada por ese permiso', () => {
    expect(areaForPath('/inventario')?.permission).toBe('video_stock.read')
  })
})
