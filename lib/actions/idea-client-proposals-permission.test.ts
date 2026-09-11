import { expect, it, vi } from 'vitest'

const requirePermission = vi.fn(async (_perm: string) => undefined)
vi.mock('@/lib/auth/server', () => ({
  requirePermission: (perm: string) => requirePermission(perm),
}))
vi.mock('./onsite', () => ({ getOnsiteShots: vi.fn(async () => ({ shots: [] })) }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: () => {
      const b: Record<string, any> = {}
      b.select = () => b
      b.eq = () => b
      b.single = async () => ({
        data: { id: 's1', client_id: 'c1', session_date: '2026-09-10', client: { name: 'X' } },
        error: null,
      })
      return b
    },
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => {
      const b: Record<string, any> = {}
      for (const k of ['select', 'eq', 'order', 'limit', 'is', 'gt']) b[k] = () => b
      b.insert = async () => ({ error: null })
      b.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null })
      return b
    },
  }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createIdeaClientProposal, listIdeaClientProposals } from './idea-client-proposals'

it('exportar / proponer ideas exige ideas.read (supervisores y editores con ese permiso)', async () => {
  await createIdeaClientProposal('s1')
  expect(requirePermission).toHaveBeenCalledWith('ideas.read')
  requirePermission.mockClear()
  await listIdeaClientProposals('s1')
  expect(requirePermission).toHaveBeenCalledWith('ideas.read')
  expect(requirePermission).not.toHaveBeenCalledWith('ideas.share')
})
