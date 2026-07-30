import { describe, it, expect, vi, beforeEach } from 'vitest'

const requirePermission = vi.fn(async () => {})
const assertOwner = vi.fn(async () => {})
vi.mock('@/lib/auth/server', () => ({
  requirePermission: () => requirePermission(),
  assertOwner: () => assertOwner(),
}))

const revalidatePath = vi.fn()
const revalidateTag = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (p: string) => revalidatePath(p),
  revalidateTag: (t: string) => revalidateTag(t),
}))

let updatePayload: Record<string, unknown> | null = null
const supa = {
  auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'me' } } })) },
  from: vi.fn(() => ({
    update: (p: Record<string, unknown>) => {
      updatePayload = p
      return { eq: async () => ({ error: null }) }
    },
    delete: () => ({ eq: async () => ({ error: null }) }),
  })),
}
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supa }))

import { pauseClient, activateClient, deleteClient } from './clients'
import { CADENCIA_TAG } from './cadencia-tag'

beforeEach(() => {
  updatePayload = null
  revalidatePath.mockClear()
  revalidateTag.mockClear()
  requirePermission.mockReset().mockResolvedValue(undefined)
  assertOwner.mockReset().mockResolvedValue(undefined)
})

/**
 * La cadencia del día se sirve de un unstable_cache de 10 minutos, y
 * revalidatePath NO limpia ese tipo de caché — hace falta revalidateTag. Sin
 * esto, pausar un cliente lo dejaba en la cadencia hasta 10 minutos más.
 */
describe('cambios de estado del cliente y la caché de cadencia', () => {
  it('pausar invalida la caché de cadencia', async () => {
    await pauseClient('c1')
    expect(updatePayload).toMatchObject({ status: 'paused' })
    expect(revalidateTag).toHaveBeenCalledWith(CADENCIA_TAG)
  })

  it('reactivar también: si no, el cliente tarda en volver', async () => {
    await activateClient('c1')
    expect(updatePayload).toMatchObject({ status: 'active' })
    expect(revalidateTag).toHaveBeenCalledWith(CADENCIA_TAG)
  })

  it('borrar también, o queda un fantasma en la cadencia', async () => {
    await deleteClient('c1')
    expect(revalidateTag).toHaveBeenCalledWith(CADENCIA_TAG)
  })

  it('sin permiso no se toca nada ni se invalida nada', async () => {
    requirePermission.mockRejectedValueOnce(new Error('No autorizado'))
    const res = await pauseClient('c1')
    expect(res.error).toBeTruthy()
    expect(updatePayload).toBeNull()
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('sigue revalidando las rutas normales, no solo la etiqueta', async () => {
    await pauseClient('c1')
    expect(revalidatePath).toHaveBeenCalledWith('/clients')
  })
})
