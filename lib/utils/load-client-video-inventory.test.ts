import { beforeEach, expect, it, vi } from 'vitest'
const h = vi.hoisted(() => ({ permission: vi.fn(), db: vi.fn(), scheduler: vi.fn(), fail: false }))
vi.mock('@/lib/auth/server', () => ({ requirePermission: h.permission }))
vi.mock('@/lib/supabase/server', () => ({ createClient: h.db }))
vi.mock('@/lib/metricool/scheduler', () => ({ getScheduledPosts: h.scheduler }))
vi.mock('next/cache', () => ({ unstable_cache: (fn: () => unknown) => fn }))
import { getClientVideoInventory } from './load-client-video-inventory'

beforeEach(() => {
  vi.clearAllMocks(); h.fail = false; h.permission.mockResolvedValue(undefined)
  h.db.mockResolvedValue({ from: (table: string) => ({ select: () => ({ order: () => ({ range: async () => ({ data: table === 'clients' ? [{ id: 'c', name: 'Cliente', status: 'active', metricool_blog_id: '1' }] : [], error: h.fail ? { message: 'failure' } : null }) }) }) }) })
  process.env.METRICOOL_TOKEN = 'test'; process.env.METRICOOL_USER_ID = 'user'
})
it('checks permission before reading any data or external calendar', async () => {
  h.permission.mockRejectedValue(new Error('Denied'))
  await expect(getClientVideoInventory()).rejects.toThrow('Denied')
  expect(h.permission).toHaveBeenCalledWith('inventory.read'); expect(h.db).not.toHaveBeenCalled(); expect(h.scheduler).not.toHaveBeenCalled()
})
it('does not turn a Metricool failure into a zero scheduled count', async () => {
  h.scheduler.mockRejectedValue(new Error('unavailable'))
  expect((await getClientVideoInventory()).rows[0].scheduled).toBeNull()
})
it('does not turn a database error into an empty successful inventory', async () => {
  h.fail = true
  await expect(getClientVideoInventory()).rejects.toThrow('No se pudo consultar')
})
