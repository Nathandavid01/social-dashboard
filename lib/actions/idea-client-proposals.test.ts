import { beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ denied: false, proposal: null as any, writes: [] as unknown[], queries: [] as unknown[] }))
vi.mock('@/lib/auth/server', () => ({ requirePermission: async () => { if (state.denied) throw new Error('No autorizado') } }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: () => { throw new Error('No database access expected') } }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: () => {
  const b: Record<string, any> = {}
  for (const key of ['select', 'eq', 'is', 'gt']) b[key] = (...args: unknown[]) => { state.queries.push([key, ...args]); return b }
  b.maybeSingle = async () => ({ data: state.proposal, error: null })
  b.upsert = async (payload: unknown) => { state.writes.push(payload); return { error: null } }
  return b
} }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
import { createIdeaClientProposal, readIdeaClientProposal, respondToIdeaProposal } from './idea-client-proposals'
beforeEach(() => { state.denied = false; state.proposal = null; state.writes = []; state.queries = [] })
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
