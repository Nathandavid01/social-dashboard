import { beforeEach, expect, it, vi } from 'vitest'
const h = vi.hoisted(() => ({
  user: 'me' as string | null,
  allowed: false,
  perms: new Set<string>(),
  effective: null as string | null,
  eq: vi.fn(),
  read: vi.fn(),
}))
vi.mock('@/lib/auth/server', () => ({
  currentUserHas: async (perm: string) => h.allowed || h.perms.has(perm),
  getEffectiveUserId: async () => h.effective ?? h.user,
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.user ? { id: h.user } : null } }) },
    from: () => {
      h.read()
      const q: any = {
        select: () => q,
        eq: (...a: any[]) => {
          h.eq(...a)
          return q
        },
        gte: () => q,
        not: () => q,
        order: () => q,
        limit: () => q,
        single: async () => ({ data: { status: 'active', approval_status: 'approved' } }),
        then: (r: any) => r({ data: [], error: null }),
      }
      return q
    },
  }),
}))
import { getAssignedRecordings } from './assigned-recordings'
beforeEach(() => {
  vi.clearAllMocks()
  h.user = 'me'
  h.allowed = false
  h.perms = new Set()
  h.effective = null
})
it('filters the personal agenda by authenticated user', async () => {
  await getAssignedRecordings()
  expect(h.eq).toHaveBeenCalledWith('videographer_id', 'me')
})
it('denies another members agenda without team access', async () => {
  expect(await getAssignedRecordings('other')).toBeNull()
  expect(h.read).not.toHaveBeenCalled()
})
it('denies anonymous callers', async () => {
  h.user = null
  expect(await getAssignedRecordings()).toBeNull()
})

it('uses the validated preview identity for the personal calendar', async () => {
  h.effective = 'videographer'
  await getAssignedRecordings()
  expect(h.eq).toHaveBeenCalledWith('videographer_id', 'videographer')
})

it('operations.overview returns full upcoming list without videographer filter', async () => {
  h.perms.add('operations.overview')
  const result = await getAssignedRecordings()
  expect(result?.overview).toBe(true)
  expect(h.eq.mock.calls.some((c) => c[0] === 'videographer_id')).toBe(false)
})

it('keeps videographer scope when viewing another member even with operations.overview', async () => {
  h.perms.add('operations.overview')
  h.perms.add('team.read')
  const result = await getAssignedRecordings('other')
  expect(result?.overview).toBe(false)
  expect(h.eq).toHaveBeenCalledWith('videographer_id', 'other')
})

it('videographer without operations.overview stays scoped to self', async () => {
  const result = await getAssignedRecordings()
  expect(result?.overview).toBe(false)
  expect(h.eq).toHaveBeenCalledWith('videographer_id', 'me')
})
