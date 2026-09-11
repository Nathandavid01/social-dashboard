import { beforeEach, describe, expect, it, vi } from 'vitest'

const requirePermission = vi.fn(async (_perm: string) => undefined)
vi.mock('@/lib/auth/server', () => ({
  requirePermission: (perm: string) => requirePermission(perm),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

let notificationFails = false
let writeFails = false
let notification: Record<string, unknown> | null = null
let previousVideographer: string | null = null
let insertPayload: Record<string, unknown> | null = null
let updatePayload: Record<string, unknown> | null = null
let userId: string | null = 'admin-1'

function makeSupabase() {
  const builder: Record<string, unknown> = {}
  builder.single = vi.fn(async () => ({ data: { id: 's1', videographer_id: previousVideographer, title: 'Grabación', session_date: '2026-09-09', client_id: 'c1', start_time: null }, error: null }))
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
  notification = null
  notificationFails = false
  writeFails = false
  previousVideographer = null
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
    expect(updatePayload).toEqual({ status: 'completed', confirmation_status: 'unconfirmed' })
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

describe('create/update — confirmation_status', () => {
  it('auto-confirma al crear con cliente, videógrafo y hora', async () => {
    const res = await createRecordingSession({
      ...baseCreate,
      videographer_id: 'v1',
      start_time: '10:00',
    })
    expect(res).toMatchObject({ success: true })
    expect(insertPayload).toEqual(expect.objectContaining({ confirmation_status: 'confirmed' }))
  })

  it('queda sin confirmar si falta la hora al crear', async () => {
    const res = await createRecordingSession({
      ...baseCreate,
      videographer_id: 'v1',
    })
    expect(res).toMatchObject({ success: true })
    expect(insertPayload).toEqual(expect.objectContaining({ confirmation_status: 'unconfirmed' }))
  })

  it('Confirmar explícito escribe confirmed', async () => {
    const res = await updateRecordingSession('s1', { confirmation_status: 'confirmed' })
    expect(res).toMatchObject({ success: true })
    expect(updatePayload).toEqual(expect.objectContaining({ confirmation_status: 'confirmed' }))
  })

  it('Unconfirmar explícito escribe unconfirmed', async () => {
    const res = await updateRecordingSession('s1', { confirmation_status: 'unconfirmed' })
    expect(res).toMatchObject({ success: true })
    expect(updatePayload).toEqual(expect.objectContaining({ confirmation_status: 'unconfirmed' }))
  })

  it('al completar la hora con cliente y videógrafo, auto-confirma', async () => {
    previousVideographer = 'v1'
    supabase = makeSupabase()
    const res = await updateRecordingSession('s1', { start_time: '09:30', videographer_id: 'v1' })
    expect(res).toMatchObject({ success: true })
    expect(updatePayload).toEqual(expect.objectContaining({
      start_time: '09:30',
      confirmation_status: 'confirmed',
    }))
  })
})
