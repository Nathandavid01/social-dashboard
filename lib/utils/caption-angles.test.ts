import { describe, it, expect } from 'vitest'
import { nombrarAngulo, sonDemasiadoParecidos } from './caption-angles'

describe('nombrarAngulo', () => {
  it('toma la primera línea no vacía, normalizada', () => {
    const a = nombrarAngulo('¡Mira esto! 🔥\n\nSegunda línea con más info.\n#tag')
    expect(a.primeraLinea).toBe('¡mira esto! 🔥')
  })

  it('detecta tipo de CTA por palabras clave conocidas', () => {
    expect(nombrarAngulo('Texto\nComenta abajo qué opinas').tipoCta).toBe('comentar')
    expect(nombrarAngulo('Texto\nReserva tu cita hoy').tipoCta).toBe('reservar')
    expect(nombrarAngulo('Texto\nCompra ahora con el link en bio').tipoCta).toBe('comprar')
    expect(nombrarAngulo('Texto\nGuarda este post para después').tipoCta).toBe('guardar')
    expect(nombrarAngulo('Texto\nEscríbenos por DM').tipoCta).toBe('mensaje')
  })

  it('sin CTA reconocible, devuelve "otro"', () => {
    expect(nombrarAngulo('Texto sin ningún llamado a la acción claro').tipoCta).toBe('otro')
  })

  it('con caption vacío devuelve valores vacíos sin explotar', () => {
    const a = nombrarAngulo('')
    expect(a.primeraLinea).toBe('')
    expect(a.tipoCta).toBe('otro')
  })
})

describe('sonDemasiadoParecidos', () => {
  it('true si la primera línea normalizada es igual', () => {
    expect(
      sonDemasiadoParecidos('¡Mira esto ya!\nResto distinto uno', '¡MIRA ESTO YA!\nResto distinto dos'),
    ).toBe(true)
  })

  it('true si el tipo de CTA coincide Y hay solapamiento fuerte de hashtags', () => {
    const a = 'Un antojo rico\nComenta si te gusta\n#comida #boricua #rico #pr'
    const b = 'Otro texto totalmente distinto arriba\nComenta qué te parece\n#comida #boricua #rico #sabor'
    expect(sonDemasiadoParecidos(a, b)).toBe(true)
  })

  it('false si primera línea distinta, CTA distinto y hashtags no se solapan', () => {
    const a = 'Detrás de cámaras del proceso\nGuarda este post\n#detras #proceso'
    const b = 'Una invitación especial para ti\nReserva tu cita\n#promo #evento'
    expect(sonDemasiadoParecidos(a, b)).toBe(false)
  })

  it('false si el mismo tipo de CTA pero sin hashtags en común y primera línea distinta', () => {
    const a = 'Antojo del viernes\nComenta tu favorito\n#viernes'
    const b = 'Testimonio real de cliente\nComenta qué opinas\n#testimonio'
    expect(sonDemasiadoParecidos(a, b)).toBe(false)
  })

  it('con captions vacíos no revienta y no marca falso positivo', () => {
    expect(sonDemasiadoParecidos('', '')).toBe(false)
    expect(sonDemasiadoParecidos('algo', '')).toBe(false)
  })
})
