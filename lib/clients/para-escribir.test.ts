import { describe, it, expect } from 'vitest'
import { paraEscribirIdeas, type ClienteEscribible } from './para-escribir'

const c = (over: Partial<ClienteEscribible> & { id: string }): ClienteEscribible => ({
  name: over.id, status: 'active', ...over,
})

describe('paraEscribirIdeas', () => {
  it('entra el que está agendado para grabar, sea cual sea su estado', () => {
    const out = paraEscribirIdeas([c({ id: 'a' })], new Set(['a']))
    expect(out.map((x) => x.id)).toEqual(['a'])
  })

  it('entra el marcado "próximo a grabar" aunque no tenga sesión agendada', () => {
    const out = paraEscribirIdeas([c({ id: 'a', status: 'proximo_a_grabar' })], new Set())
    expect(out.map((x) => x.id)).toEqual(['a'])
  })

  it('entra el marcado "sin contenido": es justo a quien hay que escribirle', () => {
    const out = paraEscribirIdeas([c({ id: 'a', status: 'sin_contenido' })], new Set())
    expect(out.map((x) => x.id)).toEqual(['a'])
  })

  it('un activo cualquiera sin agendar no entra — eran 66 y no se encontraba el de hoy', () => {
    expect(paraEscribirIdeas([c({ id: 'a' })], new Set())).toEqual([])
  })

  it('onboarding y pausado no entran ni agendados por error', () => {
    const clientes = [c({ id: 'a', status: 'onboarding' }), c({ id: 'b', status: 'paused' })]
    expect(paraEscribirIdeas(clientes, new Set(['a', 'b']))).toEqual([])
  })

  it('primero los que se quedaron sin contenido, luego los próximos a grabar', () => {
    const clientes = [
      c({ id: 'agendado' }),
      c({ id: 'proximo', status: 'proximo_a_grabar' }),
      c({ id: 'vacio', status: 'sin_contenido' }),
    ]
    const out = paraEscribirIdeas(clientes, new Set(['agendado']))
    expect(out.map((x) => x.id)).toEqual(['vacio', 'proximo', 'agendado'])
  })

  it('dentro de cada grupo, por nombre', () => {
    const clientes = [
      c({ id: '1', name: 'Zeta', status: 'sin_contenido' }),
      c({ id: '2', name: 'Alfa', status: 'sin_contenido' }),
    ]
    expect(paraEscribirIdeas(clientes, new Set()).map((x) => x.name)).toEqual(['Alfa', 'Zeta'])
  })

  it('marca si está agendado, para poder decirlo en la pantalla', () => {
    const clientes = [c({ id: 'a', status: 'proximo_a_grabar' }), c({ id: 'b' })]
    const out = paraEscribirIdeas(clientes, new Set(['b']))
    expect(out.find((x) => x.id === 'a')?.agendado).toBe(false)
    expect(out.find((x) => x.id === 'b')?.agendado).toBe(true)
  })

  it('no duplica al que está agendado Y marcado próximo a grabar', () => {
    const out = paraEscribirIdeas([c({ id: 'a', status: 'proximo_a_grabar' })], new Set(['a']))
    expect(out).toHaveLength(1)
    expect(out[0].agendado).toBe(true)
  })
})
