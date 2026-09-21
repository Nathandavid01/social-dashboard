import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  perm: 'pool.send_human' as string | null,
  idea: {} as Record<string, unknown>,
  reviewStatus: null as string | null,
  writes: [] as Record<string, unknown>[],
}))

vi.mock('@/lib/auth/server', () => ({
  requirePermission: vi.fn(async (perm: string) => {
    if (h.perm && h.perm !== perm) throw new Error('No autorizado')
  }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from(table: string) {
      const q: Record<string, unknown> = {
        select: () => q,
        eq: () => q,
        order: () => q,
        limit: () => q,
        maybeSingle: async () => {
          if (table === 'entregas_client_review_items') {
            return { data: h.reviewStatus ? { status: h.reviewStatus } : null, error: null }
          }
          return { data: h.idea, error: h.idea ? null : { message: 'missing' } }
        },
        single: async () => ({
          data: table === 'content_ideas' ? h.idea : null,
          error: h.idea ? null : { message: 'missing' },
        }),
        update: (payload: Record<string, unknown>) => {
          h.writes.push(payload)
          return q
        },
        then: (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null }),
      }
      return q
    },
  })),
}))

import { sendHumanReciboToPool } from './recibo'

beforeEach(() => {
  h.perm = 'pool.send_human'
  h.writes = []
  h.reviewStatus = null
  h.idea = {
    id: 'idea',
    status: 'producida',
    approval_status: 'approved',
    staff_client_approval: 'approved',
    client_review_status: null,
    staff_pool_ready: false,
    published_at: null,
    metricool_post_id: null,
    posted_at: null,
    client: { edit_mode: 'human' },
  }
})

describe('sendHumanReciboToPool', () => {
  it('exige pool.send_human', async () => {
    h.perm = 'entregas.read'
    expect(await sendHumanReciboToPool({ ideaId: 'idea' })).toEqual({ error: 'No autorizado' })
    expect(h.writes).toEqual([])
  })

  it('no envía un cliente AI (ellos entran solos al aprobar en Recibo)', async () => {
    ;(h.idea.client as { edit_mode: string }).edit_mode = 'ai'
    expect(await sendHumanReciboToPool({ ideaId: 'idea' })).toMatchObject({
      error: expect.stringMatching(/AI|Recibo/i),
    })
    expect(h.writes).toEqual([])
  })

  it('no salta Revisión', async () => {
    h.idea.approval_status = 'submitted'
    expect(await sendHumanReciboToPool({ ideaId: 'idea' })).toMatchObject({
      error: expect.stringMatching(/Revisión/i),
    })
    expect(h.writes).toEqual([])
  })

  it('exige aprobación del cliente', async () => {
    h.idea.staff_client_approval = null
    expect(await sendHumanReciboToPool({ ideaId: 'idea' })).toMatchObject({
      error: expect.stringMatching(/aprob/i),
    })
    expect(h.writes).toEqual([])
  })

  it('humano aprobado + Revisión → staff_pool_ready (Listo en el pool)', async () => {
    const res = await sendHumanReciboToPool({ ideaId: 'idea' })
    expect(res).toEqual({ ok: true })
    expect(h.writes).toEqual([expect.objectContaining({ staff_pool_ready: true })])
  })

  it('acepta el voto de /aprobacion como aprobación del cliente', async () => {
    h.idea.staff_client_approval = null
    h.reviewStatus = 'approved'
    expect(await sendHumanReciboToPool({ ideaId: 'idea' })).toEqual({ ok: true })
    expect(h.writes[0]).toMatchObject({ staff_pool_ready: true })
  })
})
