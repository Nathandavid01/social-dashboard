import { describe, it, expect, vi, beforeEach } from 'vitest'

const assertOwner = vi.fn(async () => {})
vi.mock('@/lib/auth/server', () => ({ assertOwner: () => assertOwner() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

let updatePayload: Record<string, unknown> | null = null
let updatedId: string | null = null
const upload = vi.fn(async () => ({ error: null }))
function makeSupabase() {
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'owner-1' } } })) },
    from: vi.fn(() => ({
      update: (p: Record<string, unknown>) => {
        updatePayload = p
        return { eq: (_col: string, id: string) => { updatedId = id; return { select: async () => ({ data: [{ id }], error: null }) } } }
      },
    })),
    storage: {
      from: vi.fn(() => ({
        upload,
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn/avatars/${path}` } }),
      })),
    },
  }
}
let supa = makeSupabase()
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supa }))

import { setUserAvatar, removeUserAvatar } from './users'

function form(file: File | null) {
  const fd = new FormData()
  if (file) fd.set('file', file)
  return fd
}

beforeEach(() => {
  supa = makeSupabase()
  updatePayload = null
  updatedId = null
  upload.mockClear()
  assertOwner.mockReset().mockResolvedValue(undefined)
})

describe('setUserAvatar (owner pone la foto de OTRO usuario)', () => {
  it('sube al bucket avatars en la ruta del usuario objetivo y guarda avatar_url con cache-bust', async () => {
    const file = new File(['x'], 'cara.PNG', { type: 'image/png' })
    const res = await setUserAvatar('u-target', form(file))
    expect(res.ok).toBe(true)
    expect(upload).toHaveBeenCalledWith('u-target/avatar.png', file, expect.objectContaining({ upsert: true, contentType: 'image/png' }))
    expect(updatedId).toBe('u-target')
    expect(String(updatePayload?.avatar_url)).toMatch(/^https:\/\/cdn\/avatars\/u-target\/avatar\.png\?v=\d+$/)
  })

  it('solo owners', async () => {
    assertOwner.mockRejectedValueOnce(new Error('Esta acción requiere rol de Owner.'))
    const res = await setUserAvatar('u-target', form(new File(['x'], 'a.jpg', { type: 'image/jpeg' })))
    expect(res.error).toMatch(/Owner/)
    expect(upload).not.toHaveBeenCalled()
  })

  it('rechaza archivos que no son imagen y mayores de 4 MB; exige archivo', async () => {
    expect((await setUserAvatar('u', form(new File(['x'], 'a.mp4', { type: 'video/mp4' })))).error).toMatch(/imágenes/)
    const big = new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'a.jpg', { type: 'image/jpeg' })
    expect((await setUserAvatar('u', form(big))).error).toMatch(/4 MB/)
    expect((await setUserAvatar('u', form(null))).error).toMatch(/requerido/i)
    expect(upload).not.toHaveBeenCalled()
  })

  it('rechaza un id de usuario vacío', async () => {
    expect((await setUserAvatar('', form(new File(['x'], 'a.jpg', { type: 'image/jpeg' })))).error).toBeTruthy()
  })
})

describe('removeUserAvatar', () => {
  it('deja avatar_url en null para el usuario objetivo', async () => {
    const res = await removeUserAvatar('u-target')
    expect(res.ok).toBe(true)
    expect(updatedId).toBe('u-target')
    expect(updatePayload?.avatar_url).toBeNull()
  })
  it('solo owners', async () => {
    assertOwner.mockRejectedValueOnce(new Error('Esta acción requiere rol de Owner.'))
    expect((await removeUserAvatar('u-target')).error).toMatch(/Owner/)
  })
})

describe('guardia de RLS', () => {
  it('si el update no alcanza ninguna fila, no dice "listo"', async () => {
    supa.from = vi.fn(() => ({
      update: () => ({ eq: () => ({ select: async () => ({ data: [], error: null }) }) }),
    })) as never
    const res = await removeUserAvatar('u-ajeno')
    expect(res.error).toMatch(/permiso/)
  })
})
