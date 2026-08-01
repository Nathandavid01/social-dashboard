import { describe, it, expect } from 'vitest'
import {
  DIAS_DE_VIGENCIA, estadoDelEnlace, puedeVotar, textoDecision,
  type EnlaceRevision,
} from './client-review'

const AHORA = new Date('2026-08-01T12:00:00Z')

const enlace = (over: Partial<EnlaceRevision> = {}): EnlaceRevision => ({
  status: 'pending',
  expiresAt: '2026-08-08T12:00:00Z',
  comment: null,
  reviewerName: null,
  ...over,
})

describe('DIAS_DE_VIGENCIA', () => {
  it('el enlace vive una semana', () => {
    expect(DIAS_DE_VIGENCIA).toBe(7)
  })
})

describe('estadoDelEnlace', () => {
  it('sin votar y dentro de plazo, está esperando', () => {
    expect(estadoDelEnlace(enlace(), AHORA)).toBe('esperando')
  })

  it('aprobado se queda aprobado aunque venza', () => {
    expect(estadoDelEnlace(enlace({ status: 'approved', expiresAt: '2026-07-01T00:00:00Z' }), AHORA)).toBe('aprobado')
  })

  it('rechazado se queda rechazado aunque venza', () => {
    expect(estadoDelEnlace(enlace({ status: 'rejected', expiresAt: '2026-07-01T00:00:00Z' }), AHORA)).toBe('rechazado')
  })

  it('sin votar y fuera de plazo, está vencido', () => {
    expect(estadoDelEnlace(enlace({ expiresAt: '2026-07-31T00:00:00Z' }), AHORA)).toBe('vencido')
  })

  it('sin enlace generado, no hay estado', () => {
    expect(estadoDelEnlace(null, AHORA)).toBe('sin_enlace')
  })

  it('sin fecha de caducidad no se considera vencido', () => {
    expect(estadoDelEnlace(enlace({ expiresAt: null }), AHORA)).toBe('esperando')
  })
})

describe('puedeVotar', () => {
  it('el cliente puede votar mientras esté esperando', () => {
    expect(puedeVotar(enlace(), AHORA)).toBe(true)
  })

  // Un voto ya emitido no se cambia desde el enlace: si el cliente se
  // arrepiente, se genera uno nuevo. Si no, un reenvío del mismo enlace podría
  // revertir un aprobado que ya movió la tarjeta.
  it('una vez votado, ya no', () => {
    expect(puedeVotar(enlace({ status: 'approved' }), AHORA)).toBe(false)
    expect(puedeVotar(enlace({ status: 'rejected' }), AHORA)).toBe(false)
  })

  it('vencido tampoco', () => {
    expect(puedeVotar(enlace({ expiresAt: '2026-07-31T00:00:00Z' }), AHORA)).toBe(false)
  })

  it('sin enlace, no', () => {
    expect(puedeVotar(null, AHORA)).toBe(false)
  })
})

describe('textoDecision', () => {
  it('rechazar sin escribir nada no vale — el editor necesita saber qué cambiar', () => {
    expect(textoDecision('rejected', '').ok).toBe(false)
    expect(textoDecision('rejected', '   ').ok).toBe(false)
  })

  it('rechazar con texto sí', () => {
    const r = textoDecision('rejected', '  Cortar el logo del final  ')
    expect(r.ok).toBe(true)
    expect(r.comment).toBe('Cortar el logo del final')
  })

  it('aprobar no exige texto', () => {
    expect(textoDecision('approved', '').ok).toBe(true)
  })

  it('aprobar conserva el comentario si lo hay', () => {
    expect(textoDecision('approved', ' Quedó bien ').comment).toBe('Quedó bien')
  })

  it('sin comentario, queda en null y no en cadena vacía', () => {
    expect(textoDecision('approved', '   ').comment).toBeNull()
  })
})
