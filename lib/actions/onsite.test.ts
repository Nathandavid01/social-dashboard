import { beforeEach, describe, expect, it, vi } from 'vitest'

const requirePermission = vi.fn(async (_perm: string) => undefined)
vi.mock('@/lib/auth/server', () => ({
  requirePermission: (perm: string) => requirePermission(perm),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

let arrivedAt: string | null = null
let updatePayload: Record<string, unknown> | null = null
let userId: string | null = 'video-1'

function makeSupabase() {
  const builder: Record<string, unknown> = {}
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.is = vi.fn(() => builder)
  builder.single = vi.fn(async () => ({
    data: arrivedAt === undefined ? null : { id: 's1', arrived_at: arrivedAt },
    error: null,
  }))
  builder.update = vi.fn((payload: Record<string, unknown>) => {
    updatePayload = payload
    return builder
  })
  builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null })
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: userId ? { id: userId } : null }, error: null })) },
    from: vi.fn(() => builder),
  }
}

let supabase = makeSupabase()
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supabase }))

import { checkInOnsite, updateOnsiteAnnotations, updateOnsiteIdea } from './onsite'

beforeEach(() => {
  requirePermission.mockReset().mockResolvedValue(undefined)
  arrivedAt = null
  updatePayload = null
  userId = 'video-1'
  supabase = makeSupabase()
})

describe('checkInOnsite', () => {
  it('pide recording.complete — sin ese permiso no sella', async () => {
    requirePermission.mockRejectedValueOnce(new Error('No autorizado'))
    const res = await checkInOnsite('s1')
    expect(res.error).toMatch(/autorizado/i)
    expect(updatePayload).toBeNull()
  })

  it('sella arrived_at y arrived_by una vez', async () => {
    const res = await checkInOnsite('s1')
    expect(res).toEqual({ ok: true })
    expect(requirePermission).toHaveBeenCalledWith('recording.complete')
    expect(updatePayload).toEqual(
      expect.objectContaining({ arrived_by: 'video-1' }),
    )
    expect(typeof updatePayload?.arrived_at).toBe('string')
  })

  it('si ya hay sello no vuelve a escribir', async () => {
    arrivedAt = '2026-08-22T12:00:00.000Z'
    supabase = makeSupabase()
    const res = await checkInOnsite('s1')
    expect(res).toEqual({ ok: true })
    expect(updatePayload).toBeNull()
  })
})

describe('updateOnsiteAnnotations', () => {
  it('pide recording.complete — sin ese permiso no escribe notas', async () => {
    requirePermission.mockRejectedValueOnce(new Error('No autorizado'))
    const res = await updateOnsiteAnnotations({ ideaId: 'i1', shootingNotes: 'Toma 2 en 35mm' })
    expect(res.error).toMatch(/autorizado/i)
    expect(updatePayload).toBeNull()
  })

  it('guarda shooting_notes con recording.complete, no recording.brief', async () => {
    const res = await updateOnsiteAnnotations({ ideaId: 'i1', shootingNotes: '  Toma 2, mejor luz  ' })
    expect(res).toEqual({ ok: true })
    expect(requirePermission).toHaveBeenCalledWith('recording.complete')
    expect(requirePermission).not.toHaveBeenCalledWith('recording.brief')
    expect(updatePayload).toEqual({ shooting_notes: 'Toma 2, mejor luz' })
  })

  it('vacío se guarda como null', async () => {
    const res = await updateOnsiteAnnotations({ ideaId: 'i1', shootingNotes: '   ' })
    expect(res).toEqual({ ok: true })
    expect(updatePayload).toEqual({ shooting_notes: null })
  })
})

describe('updateOnsiteIdea', () => {
  it('sigue pidiendo recording.brief y no escribe shooting_notes', async () => {
    const res = await updateOnsiteIdea({ ideaId: 'i1', hook: 'Nuevo hook' })
    expect(res).toEqual({ ok: true })
    expect(requirePermission).toHaveBeenCalledWith('recording.brief')
    expect(updatePayload).toEqual({ hook: 'Nuevo hook' })
    expect(updatePayload).not.toHaveProperty('shooting_notes')
  })
})
