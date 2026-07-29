import { describe, it, expect } from 'vitest'
import { hasPermission } from '@/lib/auth/permissions'
import { effectiveAreaHrefs } from '@/lib/auth/areas'

/**
 * El reparto de roles acordado. Vive en un test porque es una decisión de
 * producto, no un detalle: si alguien añade un permiso a un rol sin querer,
 * esto lo caza antes de que un editor pueda aprobar su propio video.
 */
describe('modelo de roles', () => {
  it('el editor solo llega a Revisión dentro de Trabajo', () => {
    const h = effectiveAreaHrefs('editor', null)
    expect(h.has('/revision')).toBe(true)
    // Copy y publicación viven en /entregas: no es su trabajo.
    expect(h.has('/entregas')).toBe(false)
    expect(h.has('/pipeline')).toBe(false)
    expect(h.has('/produccion')).toBe(false)
    expect(h.has('/video-reviews')).toBe(false)
    expect(h.has('/clients')).toBe(false)
  })

  it('el videógrafo hace grabación e ideas, y NO entra a Entregas', () => {
    const h = effectiveAreaHrefs('video', null)
    expect(h.has('/recording-calendar')).toBe(true)
    expect(h.has('/idea-lab')).toBe(true)
    expect(h.has('/entregas')).toBe(false)
  })

  it('el diseñador hace ideas y entrega en Revisión', () => {
    const h = effectiveAreaHrefs('disenador', null)
    expect(h.has('/idea-lab')).toBe(true)
    expect(h.has('/revision')).toBe(true)
    expect(h.has('/entregas')).toBe(false)
    expect(h.has('/pipeline')).toBe(false)
  })

  it('el rol copy trabaja en Entregas y mira Revisión para saber qué viene', () => {
    const h = effectiveAreaHrefs('copy', null)
    expect(h.has('/entregas')).toBe(true)
    expect(h.has('/revision')).toBe(true)
  })

  it('el videógrafo no entra a ninguna de las dos', () => {
    const h = effectiveAreaHrefs('video', null)
    expect(h.has('/revision')).toBe(false)
    expect(h.has('/entregas')).toBe(false)
  })

  it('solo owner y supervisor aprueban y publican', () => {
    for (const r of ['owner', 'supervisor'] as const) {
      expect(hasPermission(r, 'video.approve')).toBe(true)
      expect(hasPermission(r, 'posting.publish')).toBe(true)
    }
    for (const r of ['editor', 'video', 'disenador'] as const) {
      expect(hasPermission(r, 'video.approve')).toBe(false)
      expect(hasPermission(r, 'posting.publish')).toBe(false)
    }
  })

  it('quién sube y quién escribe el copy', () => {
    expect(hasPermission('editor', 'video.upload')).toBe(true)
    expect(hasPermission('editor', 'captions.edit')).toBe(true)
    // El diseñador entrega piezas pero el copy lo escribe otro.
    expect(hasPermission('disenador', 'video.upload')).toBe(true)
    expect(hasPermission('disenador', 'captions.edit')).toBe(false)
    // El videógrafo ni sube entregas ni escribe copy.
    expect(hasPermission('video', 'video.upload')).toBe(false)
  })

  it('el supervisor conserva Equipo y Métricas', () => {
    const h = effectiveAreaHrefs('supervisor', null)
    expect(h.has('/team')).toBe(true)
    expect(h.has('/performance')).toBe(true)
    // Ahora también gestiona usuarios, pero SOLO reparte roles de ejecución:
    // el límite lo pone canAssignRole, no el acceso a la pantalla.
    expect(h.has('/settings/users')).toBe(true)
  })
})
