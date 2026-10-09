import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'
const h = vi.hoisted(() => ({ allowed: true, scheduleAllowed: true, remote: { id: 4, uuid: 'u', text: 'Caption', draft: false, autoPublish: true, providers: [{ network: 'instagram', status: 'PENDING' }], media: ['original.mp4'], publicationDate: { dateTime: '2026-10-20T10:00:00', timezone: 'America/Puerto_Rico' } }, read: vi.fn(), write: vi.fn(), persist: vi.fn() }))
vi.mock('@/lib/auth/server', () => ({ currentUserHas: async (perm: string) => h.allowed && (perm !== 'posting.publish' || h.scheduleAllowed) }))
vi.mock('@/lib/metricool/scheduler', () => ({ getScheduledPost: (...a: unknown[]) => h.read(...a) }))
vi.mock('@/lib/metricool/post', () => ({ getServerConfig: () => ({ userToken: 'secret', userId: 'user', blogId: '1' }), updateScheduledPost: (...a: unknown[]) => h.write(...a) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: (table: string) => table === 'clients' ? { select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: { id: 'c', metricool_blog_id: '1', name: 'Client' } }) }) }) }) } : { update: (data: unknown) => { h.persist(data); return { eq: () => ({ or: async () => ({ error: null }) }) } } } }) }))
const request = (extra = {}) => new NextRequest('http://localhost/api/metricool/calendar-state', { method: 'POST', body: JSON.stringify({ clientId: 'c', blogId: '1', postId: 4, uuid: 'u', action: 'draft', expected: { draft: false, publicationDate: '2026-10-20T10:00:00', text: 'Caption' }, ...extra }) })
afterEach(() => { h.allowed = true; h.scheduleAllowed = true; vi.clearAllMocks() })
describe('calendar state writes', () => {
  it('checks permission before reading or writing', async () => {
    h.allowed = false
    expect((await POST(request())).status).toBe(403)
    expect(h.write).not.toHaveBeenCalled()
  })
  it('uses the fresh full post, updates instead of creating, and tracks rotated IDs', async () => {
    h.read.mockResolvedValueOnce(h.remote).mockResolvedValueOnce({ ...h.remote, id: 9, draft: true, autoPublish: false })
    h.write.mockResolvedValue({ data: { id: 9, uuid: 'u' } })
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(h.write).toHaveBeenCalledWith(4, '1', expect.objectContaining({ media: ['original.mp4'], uuid: 'u', draft: true, autoPublish: false }))
    expect(h.persist).toHaveBeenCalledWith(expect.objectContaining({ metricool_post_id: 9, metricool_uuid: 'u' }))
    expect(await response.json()).toMatchObject({ ok: true, confirmed: true, postId: 9 })
  })
  it('schedules a draft at the chosen local time and updates its linked calendar date', async () => {
    h.read.mockResolvedValueOnce({ ...h.remote, draft: true }).mockResolvedValueOnce({ ...h.remote, draft: false, autoPublish: true, publicationDate: { dateTime: '2099-10-22T18:30:00', timezone: 'America/Puerto_Rico' } })
    h.write.mockResolvedValue({ data: { id: 4, uuid: 'u' } })
    const response = await POST(request({ action: 'schedule', dateTime: '2099-10-22T18:30', expected: { draft: true, publicationDate: h.remote.publicationDate.dateTime, text: 'Caption' } }))
    expect(await response.json()).toMatchObject({ ok: true, confirmed: true })
    expect(h.write).toHaveBeenCalledWith(4, '1', expect.objectContaining({ draft: false, autoPublish: true, publicationDate: { dateTime: '2099-10-22T18:30:00', timezone: 'America/Puerto_Rico' } }))
    expect(h.persist).toHaveBeenCalledWith(expect.objectContaining({ publish_date: '2099-10-22' }))
  })
  it('requires publish permission to schedule even with Metricool write access', async () => {
    h.scheduleAllowed = false
    expect((await POST(request({ action: 'schedule', dateTime: '2099-10-22T18:30' }))).status).toBe(403)
    expect(h.write).not.toHaveBeenCalled()
  })
  it('rejects stale content and already published posts before changing Metricool', async () => {
    h.read.mockResolvedValue({ ...h.remote, text: 'Changed by another editor' })
    expect((await POST(request())).status).toBe(409)
    expect(h.write).not.toHaveBeenCalled()
    h.read.mockResolvedValue({ ...h.remote, providers: [{ network: 'instagram', status: 'PUBLISHED' }] })
    expect((await POST(request())).status).toBe(409)
  })
  it('does not report confirmation when the read-back fails', async () => {
    h.read.mockResolvedValueOnce(h.remote).mockRejectedValueOnce(new Error('offline'))
    h.write.mockResolvedValue({ data: { id: 4, uuid: 'u' } })
    expect(await (await POST(request())).json()).toMatchObject({ ok: true, confirmed: false, warning: expect.any(String) })
    expect(h.write).toHaveBeenCalledTimes(1)
  })
})
