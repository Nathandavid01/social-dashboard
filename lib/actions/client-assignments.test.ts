import { describe, it, expect, vi, beforeEach } from 'vitest'

const requirePermission = vi.fn(async () => {})
vi.mock('@/lib/auth/server', () => ({ requirePermission: () => requirePermission() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

let filasDevueltas: { id: string }[] = [{ id: 'c1' }]
let errorDeBase: { message: string } | null = null
let columnaEscrita: string | null = null
let payload: Record<string, unknown> | null = null
const AUTH_ID = 'actor-1'

const supa = {
  auth: { getUser: vi.fn(async () => ({ data: { user: { id: AUTH_ID } } })) },
  from: vi.fn(() => ({
    update: (p: Record<string, unknown>) => {
      payload = p
      columnaEscrita = Object.keys(p)[0]
      return {
        eq: () => ({
          select: async () => ({ data: filasDevueltas, error: errorDeBase }),
        }),
      }
    },
  })),
}
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supa }))

import { setClientAssignment } from './client-assignments'

beforeEach(() => {
  filasDevueltas = [{ id: 'c1' }]
  errorDeBase = null
  columnaEscrita = null
  payload = null
  requirePermission.mockReset().mockResolvedValue(undefined)
})

describe('setClientAssignment', () => {
  it('editor escribe assigned_to', async () => {
    await setClientAssignment({ clientId: 'c1', campo: 'editor', userId: 'u1' })
    expect(columnaEscrita).toBe('assigned_to')
  })

  it('diseñador escribe assigned_designer', async () => {
    await setClientAssignment({ clientId: 'c1', campo: 'disenador', userId: 'u1' })
    expect(columnaEscrita).toBe('assigned_designer')
  })

  it('guarda bien devuelve ok', async () => {
    const res = await setClientAssignment({ clientId: 'c1', campo: 'editor', userId: 'u1' })
    expect(res.ok).toBe(true)
    expect(res.error).toBeUndefined()
  })

  /**
   * Un UPDATE bloqueado por RLS no da error en Postgres: actualiza 0 filas. Sin
   * esta comprobación la acción devolvía "ok" y la pantalla decía que se había
   * guardado cuando no se guardó nada — así estuvieron los supervisores.
   */
  it('si no cambió ninguna fila, es un error, no un éxito', async () => {
    filasDevueltas = []
    const res = await setClientAssignment({ clientId: 'c1', campo: 'editor', userId: 'u1' })
    expect(res.ok).toBeUndefined()
    expect(res.error).toMatch(/permiso|no se guardó/i)
  })

  it('un error de la base se devuelve tal cual', async () => {
    errorDeBase = { message: 'boom' }
    const res = await setClientAssignment({ clientId: 'c1', campo: 'editor', userId: 'u1' })
    expect(res.error).toBe('boom')
  })

  it('sin permiso no escribe nada', async () => {
    requirePermission.mockRejectedValueOnce(new Error('No autorizado'))
    const res = await setClientAssignment({ clientId: 'c1', campo: 'editor', userId: 'u1' })
    expect(res.error).toBe('No autorizado')
    expect(columnaEscrita).toBeNull()
  })

  it('desasignar (null) también cuenta como guardado', async () => {
    const res = await setClientAssignment({ clientId: 'c1', campo: 'editor', userId: null })
    expect(res.ok).toBe(true)
  })

  it('records who made the change and when', async () => {
    await setClientAssignment({ clientId: 'c1', campo: 'editor', userId: 'u1' })
    expect(payload).toMatchObject({
      assigned_to: 'u1',
      assignment_changed_by: AUTH_ID,
    })
    expect(typeof payload?.assignment_changed_at).toBe('string')
  })
})
