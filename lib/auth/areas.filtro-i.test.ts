import { describe, it, expect } from 'vitest'
import { AREAS, canAccessPath, effectiveAreaHrefs } from './areas'
import { hasPermission } from './permissions'
import { navItems } from '@/components/layout/nav-items'

/**
 * Filtro I — área aparte para enviar videos.
 *
 * Vive por su cuenta: no comparte gate, ni permiso, ni ruta con /revision ni
 * con /entregas. Estos tests son lo que impide que alguien "simplifique"
 * después reutilizando `revision.read` y volviendo a atar las tres pantallas.
 */
describe('Filtro I como área propia', () => {
  const area = AREAS.find((a) => a.href === '/filtro-i')

  it('está registrada en el catálogo de áreas', () => {
    expect(area).toBeDefined()
    expect(area?.label).toBe('Filtro I')
  })

  it('tiene su propio permiso, no el de Revisión ni el de Entregas', () => {
    expect(area?.permission).toBe('filtro_i.read')
    expect(area?.permission).not.toBe('revision.read')
    expect(area?.permission).not.toBe('entregas.read')
  })

  it('sale en el sidebar con su etiqueta', () => {
    const item = navItems.find((n) => n.href === '/filtro-i')
    expect(item).toBeDefined()
    expect(item?.label).toBe('Filtro I')
    expect(item?.permission).toBe('filtro_i.read')
  })

  /**
   * Quien entrega video entra; quien solo escribe copy o solo graba, no.
   * Menor privilegio: el área es para enviar, no para mirar.
   */
  it('lo alcanzan owner, supervisor, editor y diseñador', () => {
    for (const role of ['owner', 'supervisor', 'editor', 'disenador'] as const) {
      expect(hasPermission(role, 'filtro_i.read'), role).toBe(true)
    }
  })

  it('no lo alcanzan video ni copy', () => {
    for (const role of ['video', 'copy'] as const) {
      expect(hasPermission(role, 'filtro_i.read'), role).toBe(false)
    }
  })

  it('un rol sin el permiso no puede cargar la ruta', () => {
    expect(canAccessPath('/filtro-i', 'editor', null)).toBe(true)
    expect(canAccessPath('/filtro-i', 'video', null)).toBe(false)
  })

  /**
   * Aparte de verdad: dar Filtro I a alguien no le abre Revisión ni Entregas,
   * y darle Revisión no le abre Filtro I.
   */
  it('conceder Filtro I no arrastra Revisión ni Entregas', () => {
    const alcanzables = effectiveAreaHrefs('editor', ['/filtro-i'])
    expect(alcanzables.has('/filtro-i')).toBe(true)
    expect(alcanzables.has('/revision')).toBe(false)
    expect(alcanzables.has('/entregas')).toBe(false)
  })

  it('conceder Revisión no arrastra Filtro I', () => {
    const alcanzables = effectiveAreaHrefs('editor', ['/revision'])
    expect(alcanzables.has('/filtro-i')).toBe(false)
  })
})
