import { beforeEach, describe, expect, it, vi } from 'vitest'

const requirePermission = vi.fn(async (_perm: string) => undefined)
vi.mock('@/lib/auth/server', () => ({
  requirePermission: (perm: string) => requirePermission(perm),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

let insertPayload: Record<string, unknown> | null = null
let updatePayload: Record<string, unknown> | null = null
let userId: string | null = 'admin-1'

function makeSupabase() {
  const builder: Record<string, unknown> = {}
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.gte = vi.fn(() => builder)
  builder.lt = vi.fn(() => builder)
  builder.insert = vi.fn(async (payload: Record<string, unknown>) => {
    insertPayload = payload
    return { error: null }
  })
  builder.update = vi.fn((payload: Record<string, unknown>) => {
    updatePayload = payload
    return builder
  })
  builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null })
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: userId ? { id: userId } : null }, error: null })) },
    from: vi.fn(() => builder),
  }
}

let supabase = makeSupabase()
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supabase }))

import { createRecordingSession, updateRecordingSession } from './recording-sessions'

const baseCreate = {
  session_date: '2026-08-23',
  client_id: 'c1',
  videographer_id: null as string | null,
  title: 'Blue Chiro - Recording',
}

beforeEach(() => {
  requirePermission.mockReset().mockResolvedValue(undefined)
  insertPayload = null
  updatePayload = null
  userId = 'admin-1'
  supabase = makeSupabase()
})

describe('createRecordingSession — gates', () => {
  it('sin recording.create no inserta', async () => {
    requirePermission.mockRejectedValueOnce(new Error('No autorizado'))
    const res = await createRecordingSession(baseCreate)
    expect(res.error).toMatch(/autorizado/i)
    expect(insertPayload).toBeNull()
  })

  it('sesión sin quién/dónde solo pide recording.create', async () => {
    const res = await createRecordingSession(baseCreate)
    expect(res).toEqual({ success: true })
    expect(requirePermission).toHaveBeenCalledWith('recording.create')
    expect(requirePermission).not.toHaveBeenCalledWith('recording.brief')
    expect(insertPayload).toEqual(expect.objectContaining({ title: 'Blue Chiro - Recording' }))
  })

  it('asignar videógrafo al crear pide recording.brief', async () => {
    requirePermission.mockImplementation(async (perm) => {
      if (perm === 'recording.brief') throw new Error('No autorizado')
    })
    const res = await createRecordingSession({ ...baseCreate, videographer_id: 'v1' })
    expect(res.error).toMatch(/autorizado/i)
    expect(requirePermission).toHaveBeenCalledWith('recording.brief')
    expect(insertPayload).toBeNull()
  })

  it('asignar lugar al crear pide recording.brief', async () => {
    requirePermission.mockImplementation(async (perm) => {
      if (perm === 'recording.brief') throw new Error('No autorizado')
    })
    const res = await createRecordingSession({ ...baseCreate, location: 'Blue Chiropractic' })
    expect(res.error).toMatch(/autorizado/i)
    expect(insertPayload).toBeNull()
  })
})

describe('updateRecordingSession — gates', () => {
  it('cambiar estado no pide recording.brief', async () => {
    const res = await updateRecordingSession('s1', { status: 'completed' })
    expect(res).toEqual({ success: true })
    expect(requirePermission).toHaveBeenCalledWith('recording.create')
    expect(requirePermission).not.toHaveBeenCalledWith('recording.brief')
    expect(updatePayload).toEqual({ status: 'completed' })
  })

  it('sin recording.create no actualiza', async () => {
    requirePermission.mockRejectedValueOnce(new Error('No autorizado'))
    const res = await updateRecordingSession('s1', { status: 'completed' })
    expect(res.error).toMatch(/autorizado/i)
    expect(updatePayload).toBeNull()
  })

  it('asignar videógrafo pide recording.brief y no escribe si falta', async () => {
    requirePermission.mockImplementation(async (perm) => {
      if (perm === 'recording.brief') throw new Error('No autorizado')
    })
    const res = await updateRecordingSession('s1', { videographer_id: 'v2' })
    expect(res.error).toMatch(/autorizado/i)
    expect(requirePermission).toHaveBeenCalledWith('recording.brief')
    expect(updatePayload).toBeNull()
  })

  it('asignar lugar pide recording.brief', async () => {
    requirePermission.mockImplementation(async (perm) => {
      if (perm === 'recording.brief') throw new Error('No autorizado')
    })
    const res = await updateRecordingSession('s1', { location: 'Estudio' })
    expect(res.error).toMatch(/autorizado/i)
    expect(updatePayload).toBeNull()
  })
})
