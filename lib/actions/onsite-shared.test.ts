import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({
  session: { id: 's1', client_id: 'c1', status: 'scheduled' },
  next: 's1', filter: '', denied: false,
  idea: { status: 'idea', client_id: 'c1', recording_session_id: null as string | null },
  patch: {} as Record<string, unknown>,
}))
vi.mock('@/lib/auth/server', () => ({ requirePermission: async () => { if (state.denied) throw new Error('No autorizado') } }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: (table: string) => {
  const b: Record<string, any> = {}
  for (const key of ['select', 'eq', 'neq', 'is', 'in', 'gte', 'order', 'limit']) b[key] = () => b
  b.or = (filter: string) => { state.filter = filter; return b }
  b.update = (patch: Record<string, unknown>) => { state.patch = patch; return b }
  b.single = async () => ({ data: table === 'recording_sessions' ? state.session : state.idea, error: null })
  b.then = (resolve: (value: unknown) => unknown) => resolve({ data: table === 'recording_sessions' ? [{ id: state.next }] : [], error: null })
  return b
} }) }))
import { getOnsiteShots, toggleShotRecorded, updateOnsiteIdea } from './onsite'
import { revalidatePath } from 'next/cache'

beforeEach(() => {
  state.session = { id: 's1', client_id: 'c1', status: 'scheduled' }
  state.next = 's1'; state.filter = ''; state.denied = false
  state.idea = { status: 'idea', client_id: 'c1', recording_session_id: null }
  state.patch = {}; vi.clearAllMocks()
})
describe('ideas compartidas con Onsite', () => {
  it('incluye pendientes del mismo cliente únicamente en su próxima sesión', async () => {
    await getOnsiteShots('s1')
    expect(state.filter).toBe('recording_session_id.eq.s1,and(client_id.eq.c1,recording_session_id.is.null,status.in.(idea,asignada))')
  })
  it('no muestra las pendientes en otra sesión ni en una completada', async () => {
    state.next = 's2'; await getOnsiteShots('s1'); expect(state.filter).toBe('')
    state.next = 's1'; state.session.status = 'completed'
    await getOnsiteShots('s1'); expect(state.filter).toBe('')
  })
  it('conserva la relación con la grabación al marcar una idea compartida', async () => {
    const result = await toggleShotRecorded({ ideaId: 'i1', recorded: true, sessionId: 's1' })
    expect(result.error).toBeUndefined()
    expect(state.patch).toMatchObject({ status: 'grabada', recording_session_id: 's1' })
    expect(revalidatePath).toHaveBeenCalledWith('/escribir-ideas')
  })
  it('rechaza grabar una idea de otro cliente o de otra sesión', async () => {
    state.idea.client_id = 'otro'
    expect((await toggleShotRecorded({ ideaId: 'i1', recorded: true, sessionId: 's1' })).error).toBeTruthy()
    state.idea.client_id = 'c1'; state.idea.recording_session_id = 's2'
    expect((await toggleShotRecorded({ ideaId: 'i1', recorded: true, sessionId: 's1' })).error).toBeTruthy()
    expect(state.patch).toEqual({})
  })
  it('actualiza Escribir ideas al editar desde Onsite', async () => {
    await updateOnsiteIdea({ ideaId: 'i1', hook: 'Nuevo texto' })
    expect(revalidatePath).toHaveBeenCalledWith('/escribir-ideas')
  })
  it('mantiene el permiso de lectura', async () => {
    state.denied = true
    expect((await getOnsiteShots('s1')).error).toBe('No autorizado')
    expect(state.filter).toBe('')
  })
})
