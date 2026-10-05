import { beforeEach, describe, expect, it, vi } from 'vitest'
import { revalidatePath } from 'next/cache'
import { addStaffReviewComment } from './review-staff'

const h = vi.hoisted(() => ({
  allowed: new Set<string>(['planning.move']),
  user: { id: 'u1' } as { id: string } | null,
  profile: { full_name: 'Eric Perez' } as { full_name: string } | null,
  inserts: [] as Record<string, unknown>[],
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
          insert: async (row: Record<string, unknown>) => {
            h.inserts.push(row)
            return { error: null }
          },
        }
      }
      return {}
    },
  }),
}))

describe('addStaffReviewComment', () => {
  beforeEach(() => {
    h.allowed = new Set(['planning.move'])
    h.user = { id: 'u1' }
    h.profile = { full_name: 'Eric Perez' }
    h.inserts = []
    vi.mocked(revalidatePath).mockClear()
  })

  it('rechaza un comentario vacío', async () => {
    const res = await addStaffReviewComment('idea-1', '   ')
    expect(res.error).toMatch(/escribe un comentario/i)
    expect(h.inserts).toHaveLength(0)
  })

  it('exige planning.move y no refresca Recibo', async () => {
    const res = await addStaffReviewComment('idea-1', 'Listo, lo ajustamos')
    expect(res).toEqual({ ok: true })
    expect(h.inserts[0]).toMatchObject({
      content_idea_id: 'idea-1',
      author_kind: 'staff',
      body: 'Listo, lo ajustamos',
    })
    expect(revalidatePath).toHaveBeenCalledWith('/clients')
    expect(revalidatePath).not.toHaveBeenCalledWith('/recibo')
  })
})
