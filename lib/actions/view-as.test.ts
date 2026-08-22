import { beforeEach, describe, expect, it, vi } from 'vitest'

const getCurrentRole = vi.fn(async (): Promise<string | null> => 'owner')
const cookieSet = vi.fn()
const cookieDelete = vi.fn()
let profile: { id: string; role: string; status: string; approval_status: string } | null = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'editor',
  status: 'active',
  approval_status: 'approved',
}

vi.mock('@/lib/auth/server', () => ({
  getCurrentRole: () => getCurrentRole(),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/headers', () => ({
  cookies: async () => ({ set: cookieSet, delete: cookieDelete }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: profile }),
          eq: () => ({
            eq: () => ({
              order: async () => ({ data: profile ? [profile] : [] }),
            }),
          }),
        }),
      }),
    }),
  }),
}))

import { startViewAsEditor, stopViewAs } from './view-as'

const EDITOR = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  getCurrentRole.mockReset().mockResolvedValue('owner')
  cookieSet.mockReset()
  cookieDelete.mockReset()
  profile = {
    id: EDITOR,
    role: 'editor',
    status: 'active',
    approval_status: 'approved',
  }
})

describe('startViewAsEditor', () => {
  it('un owner guarda la cookie del editor', async () => {
    const res = await startViewAsEditor(EDITOR)
    expect(res).toEqual({ ok: true })
    expect(cookieSet).toHaveBeenCalledWith(
      'nm_view_as_editor',
      EDITOR,
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
    )
  })

  it('un editor no puede entrar a la vista de otro', async () => {
    getCurrentRole.mockResolvedValue('editor')
    const res = await startViewAsEditor(EDITOR)
    expect(res.error).toMatch(/admin/i)
    expect(cookieSet).not.toHaveBeenCalled()
  })

  it('rechaza a alguien que no es editor activo', async () => {
    profile = { id: EDITOR, role: 'copy', status: 'active', approval_status: 'approved' }
    const res = await startViewAsEditor(EDITOR)
    expect(res.error).toMatch(/editor activo/)
    expect(cookieSet).not.toHaveBeenCalled()
  })
})

describe('stopViewAs', () => {
  it('borra la cookie', async () => {
    await stopViewAs()
    expect(cookieDelete).toHaveBeenCalledWith('nm_view_as_editor')
  })
})
