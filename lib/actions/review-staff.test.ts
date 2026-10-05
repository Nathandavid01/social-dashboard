import { beforeEach, describe, expect, it, vi } from 'vitest'
import { revalidatePath } from 'next/cache'
import { addStaffReviewComment, getReciboReviewComments } from './review-staff'

const h = vi.hoisted(() => ({
  allowed: new Set<string>(['planning.move', 'entregas.read']),
  user: { id: 'u1' } as { id: string } | null,
  profile: { full_name: 'Eric Perez' } as { full_name: string } | null,
  insertError: null as { message: string } | null,
  inserts: [] as Record<string, unknown>[],
  comments: [
    {
      id: 'c1',
      author_kind: 'staff',
      author_name: 'Eric Perez',
      body: 'El hook no se entiende',
      created_at: '2026-10-05T12:00:00Z',
    },
  ],
}))

vi.mock('@/lib/auth/server', () => ({
  requirePermission: vi.fn(async (perm: string) => {
    if (!h.allowed.has(perm)) throw new Error(`Acceso denegado (falta permiso: ${perm})`)
  }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/utils/idea-activity', () => ({
  logIdeaActivity: vi.fn(async () => {}),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.user } }) },
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: h.profile, error: null }),
            }),
          }),
        }
      }
      if (table === 'video_review_comments') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: h.comments, error: null }),
            }),
          }),
          insert: async (row: Record<string, unknown>) => {
            h.inserts.push(row)
            return { error: h.insertError }
          },
        }
      }
      return {}
    },
  }),
}))

describe('addStaffReviewComment', () => {
  beforeEach(() => {
    h.allowed = new Set(['planning.move', 'entregas.read'])
    h.user = { id: 'u1' }
    h.profile = { full_name: 'Eric Perez' }
    h.insertError = null
    h.inserts = []
    vi.mocked(revalidatePath).mockClear()
  })

  it('rechaza un comentario vacío', async () => {
    const res = await addStaffReviewComment('idea-1', '   ')
    expect(res.error).toMatch(/escribe un comentario/i)
    expect(h.inserts).toHaveLength(0)
  })

  it('exige planning.move', async () => {
    h.allowed.delete('planning.move')
    const res = await addStaffReviewComment('idea-1', 'El corte se ve oscuro')
    expect(res.error).toMatch(/planning.move/)
    expect(h.inserts).toHaveLength(0)
  })

  it('guarda el motivo del equipo y refresca Recibo', async () => {
    const res = await addStaffReviewComment('idea-1', 'El hook no se entiende')
    expect(res).toEqual({ ok: true })
    expect(h.inserts).toEqual([
      {
        content_idea_id: 'idea-1',
        author_kind: 'staff',
        author_id: 'u1',
        author_name: 'Eric Perez',
        body: 'El hook no se entiende',
      },
    ])
    expect(revalidatePath).toHaveBeenCalledWith('/clients')
    expect(revalidatePath).toHaveBeenCalledWith('/recibo')
  })
})

describe('getReciboReviewComments', () => {
  beforeEach(() => {
    h.allowed = new Set(['planning.move', 'entregas.read'])
  })

  it('exige entregas.read y no expone el token', async () => {
    h.allowed.delete('entregas.read')
    await expect(getReciboReviewComments('idea-1')).resolves.toEqual([])
  })

  it('devuelve el hilo de la idea', async () => {
    await expect(getReciboReviewComments('idea-1')).resolves.toEqual(h.comments)
  })
})
