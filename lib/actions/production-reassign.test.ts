import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Regresión de RBAC: `reassignTask` escribía `production_tasks.assigned_to_id`
 * sin comprobar ningún permiso, mientras que `reassignVideo` — que escribe la
 * MISMA columna — sí exige `planning.assign`. Cualquiera con sesión podía
 * moverle el trabajo a otro editor desde /produccion.
 */
const currentUserHas = vi.fn(async (_perm: string) => true)
vi.mock('@/lib/auth/server', () => ({
  currentUserHas: (perm: string) => currentUserHas(perm),
  requirePermission: vi.fn(async () => {}),
}))

const update = vi.fn(() => ({ eq: async () => ({ error: null }) }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ from: () => ({ update }) }),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { reassignTask } from './production'

beforeEach(() => {
  currentUserHas.mockReset().mockResolvedValue(true)
  update.mockClear()
})

describe('reassignTask', () => {
  it('sin planning.assign no escribe nada y devuelve error', async () => {
    currentUserHas.mockResolvedValue(false)
    const res = await reassignTask('task-1', 'editor-2')
    expect(res.error).toBeTruthy()
    expect(update).not.toHaveBeenCalled()
  })

  it('con planning.assign reasigna', async () => {
    const res = await reassignTask('task-1', 'editor-2')
    expect(res.error).toBeNull()
    expect(update).toHaveBeenCalledWith({ assigned_to_id: 'editor-2' })
    expect(currentUserHas).toHaveBeenCalledWith('planning.assign')
  })

  it('quitar la asignación también pasa por el permiso', async () => {
    currentUserHas.mockResolvedValue(false)
    const res = await reassignTask('task-1', null)
    expect(res.error).toBeTruthy()
    expect(update).not.toHaveBeenCalled()
  })
})
