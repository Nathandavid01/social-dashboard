import { beforeEach, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
const state = vi.hoisted(() => ({
  denied: false, proposal: null as any, writes: [] as any[], queries: [] as unknown[],
  sessions: [{ id: 's1', client_id: 'c1', session_date: '2026-09-10', client: { name: 'Miti Miti' } }],
  proposals: [] as any[],
  shots: [{ id: 'i1', title: 'Idea original', hook: 'Hook', visualBrief: 'Qué grabar', referenceUrl: null, shootingNotes: 'Solo equipo' }],
}))
vi.mock('@/lib/auth/server', () => ({ requirePermission: async () => { if (state.denied) throw new Error('No autorizado') } }))
vi.mock('./onsite', () => ({ getOnsiteShots: vi.fn(async () => ({ shots: state.shots })) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  from: (table: string) => {
    if (table !== 'recording_sessions') throw new Error('Unexpected authenticated table')
    let id: string
    const b = {
      select: () => b,
      eq: (_key: string, value: string) => { id = value; return b },
      single: async () => ({ data: state.sessions.find(s => s.id === id) ?? null, error: null }),
    }
    return b
  },
}) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: (table: string) => {
  if (!['idea_client_proposals', 'idea_client_responses'].includes(table)) throw new Error('Unexpected admin table')
  const b: Record<string, any> = {}
  const filters: Array<[string, unknown]> = []
  let patch: Record<string, unknown> | undefined
  for (const key of ['select', 'is', 'gt', 'order', 'limit']) b[key] = (...args: unknown[]) => { state.queries.push([key, ...args]); return b }
  b.eq = (key: string, value: unknown) => { filters.push([key, value]); state.queries.push(['eq', key, value]); return b }
  b.maybeSingle = async () => ({ data: state.proposal, error: null })
  b.upsert = async (payload: unknown) => { state.writes.push(payload); return { error: null } }
  b.insert = async (payload: unknown) => { state.writes.push(payload); return { error: null } }
  b.update = (payload: Record<string, unknown>) => { patch = payload; return b }
  b.then = (resolve: (value: unknown) => unknown) => {
    const rows = state.proposals.filter(row => filters.every(([key, value]) => row[key] === value))
    if (patch) for (const row of rows) { Object.assign(row, patch); state.writes.push({ id: row.id, ...patch }) }
    return resolve({ data: rows, error: null })
  }
  return b
} }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
import { createIdeaClientProposal, readIdeaClientProposal, respondToIdeaProposal, listIdeaClientProposals, revokeIdeaClientProposal } from './idea-client-proposals'
beforeEach(() => {
  state.denied = false; state.proposal = null; state.writes = []; state.queries = []; state.proposals = []
  state.shots[0].title = 'Idea original'
})
it('no genera enlaces sin permiso', async () => {
  state.denied = true
  expect((await createIdeaClientProposal('s1')).error).toBe('No autorizado')
})
it('no consulta la base con tokens inválidos', async () => {
  expect(await readIdeaClientProposal('bad-token')).toBeNull()
  expect(state.queries).toEqual([])
})
it('valida vigencia y revocación, y no escribe con enlace inválido', async () => {
  const result = await respondToIdeaProposal({ token: 'a'.repeat(64), ideaId: 'i1', decision: 'approved', comment: '' })
  expect(result.error).toBeTruthy()
  expect(state.queries).toContainEqual(['is', 'revoked_at', null])
  expect(state.queries.some((q: any) => q[0] === 'gt' && q[1] === 'expires_at')).toBe(true)
  expect(state.writes).toEqual([])
})
it('rechaza ideas ajenas y estados de publicación', async () => {
  state.proposal = { id: 'p1', ideas: [{ id: 'i1' }] }
  expect((await respondToIdeaProposal({ token: 'a'.repeat(64), ideaId: 'other', decision: 'approved', comment: '' })).error).toBeTruthy()
  expect((await respondToIdeaProposal({ token: 'a'.repeat(64), ideaId: 'i1', decision: 'published', comment: '' })).error).toBeTruthy()
  expect(state.writes).toEqual([])
})
it('guarda decisiones solo dentro de la propuesta, sin cambiar el pipeline', async () => {
  state.proposal = { id: 'p1', ideas: [{ id: 'i1' }] }
  expect(await respondToIdeaProposal({ token: 'a'.repeat(64), ideaId: 'i1', decision: 'rejected', comment: ' Ajustar ' })).toEqual({ ok: true })
  expect(state.writes).toEqual([expect.objectContaining({ proposal_id: 'p1', idea_id: 'i1', decision: 'rejected', comment: 'Ajustar' })])
})

it('crea una copia para el cliente y guarda únicamente el hash del token', async () => {
  const before = Date.now()
  const result = await createIdeaClientProposal('s1')
  expect(result.error).toBeUndefined()
  const token = result.path!.split('/').pop()!
  expect(token).toMatch(/^[a-f0-9]{64}$/)
  expect(state.writes).toHaveLength(1)
  const saved = state.writes[0]
  expect(saved).toMatchObject({
    session_id: 's1', client_id: 'c1', client_name: 'Miti Miti', session_date: '2026-09-10', created_by: 'u1',
    token_hash: createHash('sha256').update(token).digest('hex'),
    ideas: [{ id: 'i1', title: 'Idea original', hook: 'Hook', visualBrief: 'Qué grabar', referenceUrl: null }],
  })
  expect(JSON.stringify(saved)).not.toContain(token)
  expect(saved.ideas[0]).not.toHaveProperty('shootingNotes')
  state.shots[0].title = 'Edición posterior'
  expect(saved.ideas[0].title).toBe('Idea original')
  expect(Date.parse(saved.expires_at)).toBeGreaterThanOrEqual(before + 30 * 86400000)
  expect(Date.parse(saved.expires_at)).toBeLessThanOrEqual(Date.now() + 30 * 86400000)
})
it('lista las respuestas solo para la sesión autorizada', async () => {
  const own = { id: 'p1', session_id: 's1', ideas: [], responses: [{ idea_id: 'i1', decision: 'approved', comment: 'Bien' }] }
  state.proposals = [own, { id: 'p2', session_id: 's2', responses: [] }]
  expect(await listIdeaClientProposals('s1')).toEqual({ proposals: [own] })
  expect(state.queries).toContainEqual(['eq', 'session_id', 's1'])
})
it('revoca el enlace solicitado sin modificar otras propuestas', async () => {
  state.proposals = [{ id: 'p1', session_id: 's1', revoked_at: null }, { id: 'p2', session_id: 's1', revoked_at: null }]
  expect(await revokeIdeaClientProposal('s1', 'p1')).toEqual({ ok: true })
  expect(state.proposals[0].revoked_at).toMatch(/^\d{4}-/)
  expect(state.proposals[1].revoked_at).toBeNull()
  expect(state.writes).toHaveLength(1)
})
it('no revoca una propuesta de otra sesión aunque su identificador sea válido', async () => {
  state.proposals = [{ id: 'p2', session_id: 's2', revoked_at: null }]
  await revokeIdeaClientProposal('s1', 'p2')
  expect(state.queries).toContainEqual(['eq', 'id', 'p2'])
  expect(state.queries).toContainEqual(['eq', 'session_id', 's1'])
  expect(state.proposals[0].revoked_at).toBeNull()
  expect(state.writes).toEqual([])
})
it('no lista ni revoca propuestas sin permiso o con una sesión no visible', async () => {
  state.denied = true
  expect(await listIdeaClientProposals('s1')).toEqual({ error: 'No autorizado' })
  expect(await revokeIdeaClientProposal('s1', 'p1')).toEqual({ error: 'No autorizado' })
  state.denied = false
  expect(await listIdeaClientProposals('invisible')).toEqual({ error: 'No autorizado' })
  expect(await revokeIdeaClientProposal('invisible', 'p1')).toEqual({ error: 'No autorizado' })
  expect(state.queries).toEqual([])
  expect(state.writes).toEqual([])
})
