import { describe, it, expect, vi, beforeEach } from 'vitest'

let currentStore: { get: (n: string) => { value: string } | undefined }
vi.mock('next/headers', () => ({ cookies: async () => currentStore }))

const getUser = vi.fn(async () => ({ data: { user: { id: 'u1', email: 'e@x.com' } }, error: null }))
const profilesSelect = vi.fn()
function makeFrom() {
  return vi.fn((table: string) => {
    const row =
      table === 'profiles'
        ? { role: 'owner', area_access: null, id: 'u1', full_name: 'Eric', status: 'active', approval_status: 'approved' }
        : null
    const chain: Record<string, unknown> = {}
    const self = () => chain
    Object.assign(chain, {
      select: vi.fn((...a: unknown[]) => { if (table === 'profiles') profilesSelect(...a); return chain }),
      eq: self,
      maybeSingle: async () => ({ data: row, error: null }),
      single: async () => ({ data: row, error: null }),
    })
    return chain
  })
}
const from = makeFrom()
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser, signOut: vi.fn() }, from }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => null }))

import {
  requirePermission, currentUserHas, getEffectiveRole, getEffectiveUserId,
  getCurrentRole, getViewAsEditor, getAuthUser, getOwnProfile,
} from './server'

beforeEach(() => {
  currentStore = { get: () => undefined }
  getUser.mockClear()
  profilesSelect.mockClear()
})

describe('helpers de auth — una sola validación de sesión por request', () => {
  it('el patrón de una página (requirePermission + rol + permiso + userId) valida la sesión UNA vez y lee el perfil UNA vez', async () => {
    await requirePermission('pipeline.read')
    const [role, has, uid, real] = await Promise.all([
      getEffectiveRole(),
      currentUserHas('planning.assign'),
      getEffectiveUserId(),
      getCurrentRole(),
    ])
    expect(role).toBe('owner')
    expect(has).toBe(true)
    expect(uid).toBe('u1')
    expect(real).toBe('owner')
    expect(getUser).toHaveBeenCalledTimes(1)
    expect(profilesSelect).toHaveBeenCalledTimes(1)
  })

  it('getAuthUser y getOwnProfile se memoizan y comparten la misma sesión', async () => {
    const [u1, u2, p1, p2] = await Promise.all([getAuthUser(), getAuthUser(), getOwnProfile(), getOwnProfile()])
    expect(u1?.id).toBe('u1')
    expect(u2).toBe(u1)
    expect(p1?.full_name).toBe('Eric')
    expect(p2).toBe(p1)
    expect(getUser).toHaveBeenCalledTimes(1)
    expect(profilesSelect).toHaveBeenCalledTimes(1)
  })

  it('getViewAsEditor sin cookie no toca la base y se memoiza', async () => {
    expect(await getViewAsEditor()).toBeNull()
    expect(await getViewAsEditor()).toBeNull()
    expect(getUser).toHaveBeenCalledTimes(1)
  })

  it('un request nuevo vuelve a validar la sesión (la memo no cruza requests)', async () => {
    await getCurrentRole()
    currentStore = { get: () => undefined }
    await getCurrentRole()
    expect(getUser).toHaveBeenCalledTimes(2)
  })
})
