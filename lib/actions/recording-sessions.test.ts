import { beforeEach, describe, expect, it, vi } from 'vitest'

const requirePermission = vi.fn(async (_perm: string) => undefined)
const currentUserHas = vi.fn(async (_perm: string) => false)
vi.mock('@/lib/auth/server', () => ({
  requirePermission: (perm: string) => requirePermission(perm),
  currentUserHas: (perm: string) => currentUserHas(perm),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

let notificationFails = false
let writeFails = false
let notification: Record<string, unknown> | null = null
let previousVideographer: string | null = null
let priorVideoAt: string | null = null
let priorClientAt: string | null = null
let insertPayload: Record<string, unknown> | null = null
let updatePayload: Record<string, unknown> | null = null
let userId: string | null = 'admin-1'

function makeSupabase() {
  const builder: Record<string, unknown> = {}
  builder.single = vi.fn(async () => ({ data: { id: 's1', videographer_id: previousVideographer, title: 'Grabación', session_date: '2026-09-09', videographer_confirmed_at: priorVideoAt, client_confirmed_at: priorClientAt }, error: null }))
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
  builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: writeFails ? { message: "write failed" } : null })
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: userId ? { id: userId } : null }, error: null })) },
    from: vi.fn((table: string) => table === 'notifications' ? { insert: async (payload: Record<string, unknown>) => { notification = payload; return { error: notificationFails ? { message: 'offline' } : null } } } : builder),
  }
}

let supabase = makeSupabase()
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supabase }))

import {
  createRecordingSession,
  updateRecordingSession,
  confirmRecordingClient,
  confirmRecordingVideographer,
  unconfirmRecordingClient,
  unconfirmRecordingVideographer,
} from './recording-sessions'

const baseCreate = {
  session_date: '2026-08-23',
  client_id: 'c1',
  videographer_id: null as string | null,
  title: 'Blue Chiro - Recording',
}

beforeEach(() => {
  requirePermission.mockReset().mockResolvedValue(undefined)
  insertPayload = null
  notification = null
  notificationFails = false
  writeFails = false
  previousVideographer = null
  priorVideoAt = null
  priorClientAt = null
  updatePayload = null
  userId = 'admin-1'
  currentUserHas.mockReset().mockResolvedValue(false)
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
    expect(res).toMatchObject({ success: true })
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
    expect(res).toMatchObject({ success: true })
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

it('notifies the newly assigned videographer after saving', async () => {
 await updateRecordingSession('s1', {videographer_id:'v2'})
 expect(notification).toMatchObject({user_id:'v2',kind:'task_assigned',link:'/onsite?s=s1'})
})
it('does not notify again when the assignment is unchanged', async () => {
 previousVideographer='v2'
 await updateRecordingSession('s1', {videographer_id:'v2'})
 expect(notification).toBeNull()
})
it('notifies a videographer assigned during creation', async () => {
 await createRecordingSession({...baseCreate,videographer_id:'v1'})
 expect(notification).toMatchObject({user_id:'v1',kind:'task_assigned'})
})

it('keeps a saved assignment and reports notification failure', async () => {
 notificationFails=true
 const result=await updateRecordingSession('s1',{videographer_id:'v2'})
 expect(result).toMatchObject({success:true})
 expect(result.warning).toContain('no se pudo enviar')
})
it('does not notify if the assignment fails to save', async () => {
 writeFails=true
 const result=await updateRecordingSession('s1',{videographer_id:'v2'})
 expect(result.error).toBe('write failed')
 expect(notification).toBeNull()
})


describe('dual-party confirm / unconfirm', () => {
  it('denies without recording.create or operations.overview', async () => {
    const res = await confirmRecordingClient('s1')
    expect(res.error).toMatch(/acceso denegado|autorizado/i)
    expect(updatePayload).toBeNull()
  })

  it('confirmRecordingClient sets client timestamp and keeps unconfirmed alone', async () => {
    currentUserHas.mockImplementation(async (p) => p === 'recording.create')
    const res = await confirmRecordingClient('s1')
    expect(res).toMatchObject({ success: true, confirmation_status: 'unconfirmed' })
    expect(typeof (res as { client_confirmed_at?: string }).client_confirmed_at).toBe('string')
    expect(updatePayload).toEqual(expect.objectContaining({
      confirmation_status: 'unconfirmed',
      client_confirmed_at: expect.any(String),
    }))
  })

  it('both sides set confirmation_status confirmed', async () => {
    currentUserHas.mockImplementation(async (p) => p === 'operations.overview')
    priorVideoAt = '2026-09-13T10:00:00Z'
    const res = await confirmRecordingClient('s1')
    expect(res).toMatchObject({ success: true, confirmation_status: 'confirmed' })
    expect(updatePayload).toEqual(expect.objectContaining({ confirmation_status: 'confirmed' }))
  })

  it('confirmRecordingVideographer sets videographer timestamp', async () => {
    currentUserHas.mockImplementation(async (p) => p === 'recording.create')
    priorClientAt = '2026-09-13T10:00:00Z'
    const res = await confirmRecordingVideographer('s1')
    expect(res).toMatchObject({ success: true, confirmation_status: 'confirmed' })
    expect(updatePayload).toEqual(expect.objectContaining({
      confirmation_status: 'confirmed',
      videographer_confirmed_at: expect.any(String),
    }))
  })

  it('unconfirm clears side and demotes confirmation_status', async () => {
    currentUserHas.mockImplementation(async (p) => p === 'recording.create')
    priorVideoAt = '2026-09-13T10:00:00Z'
    priorClientAt = '2026-09-13T11:00:00Z'
    const res = await unconfirmRecordingClient('s1')
    expect(res).toMatchObject({ success: true, confirmation_status: 'unconfirmed', client_confirmed_at: null })
    expect(updatePayload).toEqual(expect.objectContaining({
      client_confirmed_at: null,
      confirmation_status: 'unconfirmed',
    }))
  })

  it('unconfirmRecordingVideographer clears video side', async () => {
    currentUserHas.mockImplementation(async (p) => p === 'recording.create')
    priorVideoAt = '2026-09-13T10:00:00Z'
    priorClientAt = '2026-09-13T11:00:00Z'
    const res = await unconfirmRecordingVideographer('s1')
    expect(res).toMatchObject({ success: true, confirmation_status: 'unconfirmed', videographer_confirmed_at: null })
  })
})
