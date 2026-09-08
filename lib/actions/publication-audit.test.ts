import { beforeEach, afterEach, expect, it, vi } from 'vitest'
const h = vi.hoisted(() => ({ permission: vi.fn(), db: vi.fn(), posts: vi.fn(), config: vi.fn() }))
vi.mock('@/lib/auth/server', () => ({ requirePermission: h.permission }))
vi.mock('@/lib/supabase/server', () => ({ createClient: h.db }))
vi.mock('@/lib/metricool/post', () => ({ getServerConfig: h.config }))
vi.mock('@/lib/metricool/scheduler', () => ({ getScheduledPosts: h.posts }))
import { auditUpcomingPublications } from './publication-audit'
beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-07T14:00:00Z'))
  h.permission.mockResolvedValue(undefined)
  h.config.mockReturnValue({ userToken: 'test', userId: 'user', blogId: 'default' })
  h.db.mockResolvedValue({ from(table: string) {
    const data = table === 'clients' ? [
      { id: 'a', name: 'Arasibo', metricool_blog_id: 'arasibo' },
      { id: 'b', name: 'Missing', metricool_blog_id: null },
      { id: 'c', name: 'Unavailable', metricool_blog_id: 'offline' },
    ] : [{ client_id: 'a' }]
    const q: any = { select: () => q, eq: () => q, order: () => q, gte: () => q, lte: () => q, neq: () => q, limit: () => q,
      then: (resolve: any) => resolve({ data, error: null }) }
    return q
  } })
  h.posts.mockImplementation(async ({ blogId }) => {
    if (blogId === 'offline') throw new Error('upstream failed')
    return [{ publicationDate: { dateTime: '2026-09-08T08:30:00' }, draft: true, autoPublish: true, providers: [{ status: 'PENDING' }] }]
  })
})
afterEach(() => vi.useRealTimers())
it('denies unauthorized inspection before reading clients or contacting Metricool', async () => {
  h.permission.mockRejectedValueOnce(new Error('No autorizado'))
  expect(await auditUpcomingPublications()).toEqual({ error: 'No autorizado' })
  expect(h.permission).toHaveBeenCalledWith('metricool.read')
  expect(h.db).not.toHaveBeenCalled(); expect(h.posts).not.toHaveBeenCalled()
})
it('distinguishes drafts, missing connections and upstream failures for tomorrow in PR', async () => {
  const result = await auditUpcomingPublications()
  expect(result.report).toMatchObject({ start: '2026-09-08', end: '2026-09-21', rows: [
    { id: 'a', planned: 1, scheduled: 0, drafts: 1 },
    { id: 'b', error: 'Falta conectar Metricool' },
    { id: 'c', error: 'No se pudo consultar Metricool; estado sin verificar' },
  ] })
  expect(h.posts).toHaveBeenCalledWith(expect.objectContaining({ blogId: 'arasibo' }), '2026-09-08T00:00:00', '2026-09-21T23:59:59')
  expect(h.posts).toHaveBeenCalledTimes(2)
})
