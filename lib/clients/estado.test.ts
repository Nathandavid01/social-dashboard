import { describe, it, expect } from 'vitest'
import {
  CLIENT_ESTADOS, ESTADOS_VIVOS, esVivo, estadoLabel, estadoTone, esEstadoValido,
} from './estado'

describe('CLIENT_ESTADOS', () => {
  it('lleva los cinco estados, en el orden del desplegable', () => {
    expect(CLIENT_ESTADOS.map((e) => e.key)).toEqual([
      'active', 'proximo_a_grabar', 'sin_contenido', 'onboarding', 'paused',
    ])
  })

  it('cada estado tiene etiqueta en español', () => {
    for (const e of CLIENT_ESTADOS) expect(e.label.length).toBeGreaterThan(0)
  })
})

describe('ESTADOS_VIVOS', () => {
  // Esto es lo que decide si un cliente sale en cadencia, Metricool, captions y
  // el plan semanal. Marcarlo "próximo a grabar" no puede sacarlo de ahí.
  it('activo, próximo a grabar y sin contenido son clientes vivos', () => {
    expect(ESTADOS_VIVOS).toContain('active')
    expect(ESTADOS_VIVOS).toContain('proximo_a_grabar')
    expect(ESTADOS_VIVOS).toContain('sin_contenido')
  })

  it('onboarding y pausado no entran en el flujo de publicación', () => {
    expect(ESTADOS_VIVOS).not.toContain('onboarding')
    expect(ESTADOS_VIVOS).not.toContain('paused')
  })

  it('sale de la tabla, no de una lista escrita a mano', () => {
    expect(ESTADOS_VIVOS).toEqual(CLIENT_ESTADOS.filter((e) => e.vivo).map((e) => e.key))
  })
})

describe('esVivo', () => {
  it('reconoce los tres estados de producción', () => {
    expect(esVivo('active')).toBe(true)
    expect(esVivo('proximo_a_grabar')).toBe(true)
    expect(esVivo('sin_contenido')).toBe(true)
  })

  it('descarta onboarding y pausado', () => {
    expect(esVivo('onboarding')).toBe(false)
    expect(esVivo('paused')).toBe(false)
  })

  it('un estado desconocido no cuenta como vivo', () => {
    expect(esVivo('cualquier_cosa')).toBe(false)
    expect(esVivo(null)).toBe(false)
    expect(esVivo(undefined)).toBe(false)
  })
})

describe('estadoLabel', () => {
  it('traduce las claves de la base de datos', () => {
    expect(estadoLabel('active')).toBe('Activo')
    expect(estadoLabel('proximo_a_grabar')).toBe('Próximo a grabar')
    expect(estadoLabel('sin_contenido')).toBe('Sin contenido')
    expect(estadoLabel('paused')).toBe('Pausado')
  })

  it('un estado que no conoce se muestra tal cual, no como "undefined"', () => {
    expect(estadoLabel('archivado')).toBe('archivado')
    expect(estadoLabel(null)).toBe('—')
  })
})

describe('estadoTone', () => {
  it('cada estado tiene su color', () => {
    const tonos = CLIENT_ESTADOS.map((e) => estadoTone(e.key))
    expect(new Set(tonos).size).toBe(CLIENT_ESTADOS.length)
  })

  it('uno desconocido no deja el badge sin clases', () => {
    expect(estadoTone('archivado').length).toBeGreaterThan(0)
  })
})

describe('esEstadoValido', () => {
  it('acepta los cinco', () => {
    for (const e of CLIENT_ESTADOS) expect(esEstadoValido(e.key)).toBe(true)
  })
  it('rechaza lo demás', () => {
    expect(esEstadoValido('activo')).toBe(false)
    expect(esEstadoValido('')).toBe(false)
  })
})
