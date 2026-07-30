import { describe, it, expect } from 'vitest'
import { clientSchema } from './client.schema'
import { CLIENT_ESTADOS } from '@/lib/clients/estado'

const base = {
  name: 'Barber Lab',
  platforms: ['instagram' as const],
  status: 'active',
  caption_language: 'spanish' as const,
}

describe('clientSchema.status', () => {
  it('acepta los cinco estados', () => {
    for (const e of CLIENT_ESTADOS) {
      expect(clientSchema.safeParse({ ...base, status: e.key }).success, e.key).toBe(true)
    }
  })

  it('acepta los dos nuevos por nombre, no solo por la tabla', () => {
    expect(clientSchema.safeParse({ ...base, status: 'proximo_a_grabar' }).success).toBe(true)
    expect(clientSchema.safeParse({ ...base, status: 'sin_contenido' }).success).toBe(true)
  })

  it('rechaza un estado inventado', () => {
    expect(clientSchema.safeParse({ ...base, status: 'activo' }).success).toBe(false)
    expect(clientSchema.safeParse({ ...base, status: '' }).success).toBe(false)
  })
})
