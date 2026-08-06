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

/**
 * Grok-ing — donde vive el caption que sale del análisis de Filtro I.
 *
 * La regla de producto es que EL EDITOR NO VE EL CAPTION. Eso no se sostiene
 * escondiendo un componente: se sostiene aquí, en que son dos permisos y el
 * editor solo tiene uno. Si alguien fusionara los permisos "para simplificar",
 * estos tests lo paran.
 */
describe('Grok-ing como área separada de Filtro I', () => {
  const area = AREAS.find((a) => a.href === '/grok-ing')

  it('está registrada con su etiqueta y su permiso propio', () => {
    expect(area?.label).toBe('Grok-ing')
    expect(area?.permission).toBe('grok_ing.read')
    expect(area?.permission).not.toBe('filtro_i.read')
  })

  it('sale en el sidebar', () => {
    expect(navItems.find((n) => n.href === '/grok-ing')?.permission).toBe('grok_ing.read')
  })

  /** El punto entero de que sean dos áreas. */
  it('el editor entrega en Filtro I pero NO llega a Grok-ing', () => {
    expect(hasPermission('editor', 'filtro_i.read')).toBe(true)
    expect(hasPermission('editor', 'grok_ing.read')).toBe(false)
    expect(canAccessPath('/grok-ing', 'editor', null)).toBe(false)
  })

  it('el diseñador tampoco', () => {
    expect(hasPermission('disenador', 'filtro_i.read')).toBe(true)
    expect(hasPermission('disenador', 'grok_ing.read')).toBe(false)
  })

  it('lo alcanzan owner, supervisor y copy — quienes trabajan el caption', () => {
    for (const role of ['owner', 'supervisor', 'copy'] as const) {
      expect(hasPermission(role, 'grok_ing.read'), role).toBe(true)
    }
  })

  it('copy ve el caption pero no la pantalla de entrega', () => {
    expect(hasPermission('copy', 'grok_ing.read')).toBe(true)
    expect(hasPermission('copy', 'filtro_i.read')).toBe(false)
  })

  it('conceder una no arrastra la otra', () => {
    expect(effectiveAreaHrefs('editor', ['/filtro-i']).has('/grok-ing')).toBe(false)
    expect(effectiveAreaHrefs('copy', ['/grok-ing']).has('/filtro-i')).toBe(false)
  })
})
