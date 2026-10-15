import { beforeEach, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  allowed: true,
  read: vi.fn(),
  client: { id: '11111111-1111-4111-8111-111111111111', name: 'La Guira', posting_days: [1, 3, 5], posting_time: '18:00', logo_url: null, metricool_blog_id: null, assigned_to: null } as Record<string, unknown> | null,
  ideas: [] as unknown[],
  sign: vi.fn(async (_ids: string[]) => ({ urls: { v2: 'https://signed/v2.jpg' } })),
}))

vi.mock('@/lib/auth/server', () => ({ currentUserHas: async () => h.allowed }))
vi.mock('@/lib/integrations/r2-cover-urls', () => ({ signCoverUrls: (ids: string[]) => h.sign(ids) }))
vi.mock('@/lib/inventario/load-video-stock', () => ({ metricoolPictures: async () => ({}) }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      h.read(table)
      const q: any = {
        select: () => q,
        eq: () => q,
        neq: () => q,
        order: () => q,
        limit: () => q,
        maybeSingle: async () => ({ data: table === 'clients' ? h.client : null, error: null }),
        then: (r: any) => r({ data: h.ideas, error: null }),
      }
      return q
    },
  }),
}))

import { getClientStockDetail } from './video-stock-detail'

beforeEach(() => {
  vi.clearAllMocks()
  h.allowed = true
  h.ideas = []
})

it('refuses without video_stock.read and reads nothing', async () => {
  h.allowed = false
  expect(await getClientStockDetail('11111111-1111-4111-8111-111111111111')).toEqual({ error: 'No autorizado' })
  expect(h.read).not.toHaveBeenCalled()
})

it('rejects a malformed client id before touching the database', async () => {
  expect(await getClientStockDetail("x' or 1=1")).toEqual({ error: 'Cliente inválido' })
  expect(h.read).not.toHaveBeenCalled()
})

it('returns the profile, the 14-day calendar and signed covers for upcoming posts', async () => {
  h.ideas = [
    { id: 'ag', title: 'Agendado', status: 'producida', metricool_post_id: 3, publish_date: '2099-01-05', videos: [{ id: 'v2', kind: 'edited', status: 'uploaded' }] },
  ]
  const res = await getClientStockDetail('11111111-1111-4111-8111-111111111111')
  if (!('detail' in res) || !res.detail) throw new Error('expected detail')
  expect(res.detail.profile).toMatchObject({ name: 'La Guira', postingDays: [1, 3, 5], postingTime: '18:00' })
  expect(res.detail.profile.formats).toEqual({ 1: null, 3: null, 5: null })
  expect(res.detail.calendar).toHaveLength(14)
  expect(res.detail.upcoming[0]).toMatchObject({ id: 'ag', coverUrl: 'https://signed/v2.jpg' })
  expect(h.sign).toHaveBeenCalledWith(['v2'])
})

it('says so when the client does not exist', async () => {
  h.client = null
  expect(await getClientStockDetail('11111111-1111-4111-8111-111111111111')).toEqual({ error: 'Cliente no encontrado' })
})
