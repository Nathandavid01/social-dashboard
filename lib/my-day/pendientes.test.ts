import { describe, it, expect } from 'vitest'
import { pendientesPara, type DatosPendientes } from './pendientes'

const datos = (over: Partial<DatosPendientes> = {}): DatosPendientes => ({
  porRevisar: 0,
  devueltos: 0,
  esperandoCopy: 0,
  listosMetricool: 0,
  grabacionesProximas: 0,
  ideasSinGrabar: 0,
  ...over,
})

describe('pendientesPara', () => {
  // Lo que hacía inservible la pantalla anterior: 32 filas de hace un mes. Si
  // no hay nada que hacer, no se enseña nada.
  it('sin nada pendiente, no devuelve tarjetas', () => {
    expect(pendientesPara('supervisor', datos())).toEqual([])
  })

  it('un contador en cero no ocupa sitio', () => {
    const p = pendientesPara('supervisor', datos({ porRevisar: 16 }))
    expect(p).toHaveLength(1)
    expect(p[0].count).toBe(16)
  })

  describe('supervisor y owner ven el flujo entero', () => {
    it('lo primero es lo que bloquea a los demás', () => {
      const p = pendientesPara('supervisor', datos({ porRevisar: 16, esperandoCopy: 3, listosMetricool: 2 }))
      expect(p[0].key).toBe('porRevisar')
      expect(p[0].tone).toBe('urgente')
    })

    it('el owner ve lo mismo', () => {
      expect(pendientesPara('owner', datos({ porRevisar: 5 })).map((x) => x.key))
        .toEqual(pendientesPara('supervisor', datos({ porRevisar: 5 })).map((x) => x.key))
    })
  })

  describe('editor', () => {
    it('ve lo que le devolvieron, y es urgente: es retrabajo parado', () => {
      const p = pendientesPara('editor', datos({ devueltos: 3 }))
      expect(p[0].key).toBe('devueltos')
      expect(p[0].tone).toBe('urgente')
    })

    // No tiene entregas.read: mandarlo a /entregas es mandarlo a un error.
    it('no ve lo que no puede abrir', () => {
      const p = pendientesPara('editor', datos({ porRevisar: 16, esperandoCopy: 3, listosMetricool: 2 }))
      expect(p).toEqual([])
    })

    it('todas sus tarjetas llevan a una pantalla que puede abrir', () => {
      for (const x of pendientesPara('editor', datos({ devueltos: 2 }))) {
        expect(x.href).toBe('/revision')
      }
    })
  })

  describe('copy', () => {
    it('lo suyo es el copy, y va primero', () => {
      const p = pendientesPara('copy', datos({ esperandoCopy: 3, listosMetricool: 2 }))
      expect(p[0].key).toBe('esperandoCopy')
      expect(p[0].tone).toBe('urgente')
    })

    it('no le toca revisar', () => {
      expect(pendientesPara('copy', datos({ porRevisar: 16 }))).toEqual([])
    })
  })

  describe('videógrafo', () => {
    it('ve grabaciones e ideas por grabar', () => {
      const p = pendientesPara('video', datos({ grabacionesProximas: 2, ideasSinGrabar: 143 }))
      expect(p.map((x) => x.key)).toEqual(['grabacionesProximas', 'ideasSinGrabar'])
    })

    it('no ve nada del flujo de edición', () => {
      expect(pendientesPara('video', datos({ porRevisar: 16, devueltos: 3 }))).toEqual([])
    })
  })

  it('el diseñador ve lo que le devolvieron', () => {
    expect(pendientesPara('disenador', datos({ devueltos: 2 }))[0].key).toBe('devueltos')
  })

  it('sin rol no se enseña nada', () => {
    expect(pendientesPara(null, datos({ porRevisar: 16 }))).toEqual([])
  })

  it('cada tarjeta trae etiqueta, destino y número', () => {
    for (const x of pendientesPara('supervisor', datos({ porRevisar: 1, devueltos: 1, esperandoCopy: 1, listosMetricool: 1, grabacionesProximas: 1 }))) {
      expect(x.label.length).toBeGreaterThan(0)
      expect(x.href.startsWith('/')).toBe(true)
      expect(x.count).toBeGreaterThan(0)
    }
  })
})
