import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'
const h = vi.hoisted(() => ({ allowed: true, scheduleAllowed: true, deleteAllowed: true, del: vi.fn(), remote: { id: 4, uuid: 'u', text: 'Caption', draft: false, autoPublish: true, providers: [{ network: 'instagram', status: 'PENDING' }], media: ['original.mp4'], publicationDate: { dateTime: '2026-10-20T10:00:00', timezone: 'America/Puerto_Rico' } }, read: vi.fn(), write: vi.fn(), persist: vi.fn(), activity: vi.fn(), auditFails: false }))
vi.mock('@/lib/auth/server', () => ({ currentUserHas: async (perm: string) => h.allowed && (perm !== 'posting.publish' || h.scheduleAllowed) && (perm !== 'posting.calendar.delete_draft' || h.deleteAllowed) }))
vi.mock('@/lib/metricool/scheduler', () => ({ getScheduledPost: (...a: unknown[]) => h.read(...a) }))
vi.mock('@/lib/metricool/post', () => ({ getServerConfig: () => ({ userToken: 'secret', userId: 'user', blogId: '1' }), updateScheduledPost: (...a: unknown[]) => h.write(...a), deleteScheduledPost: (...a: unknown[]) => h.del(...a) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'real-user' } }, error: null }) }, from: (table: string) => table === 'clients' ? { select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: { id: 'c', metricool_blog_id: '1', name: 'Client' } }) }) }) }) } : table === 'content_idea_activity' ? { insert: async (rows: unknown) => { h.activity(rows); return { error: h.auditFails ? { message: 'Audit unavailable' } : null } } } : { update: (data: unknown) => { h.persist(data); return { eq: () => ({ or: () => { const result = { data: [{ id: 'idea-1' }], error: null }; return Object.assign(Promise.resolve(result), { select: async () => result }) } }) } } } }) }))
const request = (extra = {}) => new NextRequest('http://localhost/api/metricool/calendar-state', { method: 'POST', body: JSON.stringify({ clientId: 'c', blogId: '1', postId: 4, uuid: 'u', action: 'draft', expected: { draft: false, publicationDate: '2026-10-20T10:00:00', text: 'Caption' }, ...extra }) })
afterEach(() => { h.allowed = true; h.scheduleAllowed = true; h.deleteAllowed = true; h.auditFails = false; vi.clearAllMocks() })
describe('calendar state writes', () => {
  it('reports audit failure without denying a confirmed Metricool write', async () => {
    h.auditFails = true
    h.read.mockResolvedValueOnce(h.remote).mockResolvedValueOnce({ ...h.remote, draft: true, autoPublish: false })
    h.write.mockResolvedValue({ data: { id: 4, uuid: 'u' } })
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, confirmed: true, warning: expect.stringContaining('historial') })
  })
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
    expect(h.activity).toHaveBeenCalledWith([expect.objectContaining({ content_idea_id: 'idea-1', user_id: 'real-user', action: 'posted_to_metricool', metadata: expect.objectContaining({ draft: true, autoPublish: false, metricoolPostId: 9 }) })])
  })
  it('schedules a draft at the chosen local time and updates its linked calendar date', async () => {
    h.read.mockResolvedValueOnce({ ...h.remote, draft: true }).mockResolvedValueOnce({ ...h.remote, draft: false, autoPublish: true, publicationDate: { dateTime: '2099-10-22T18:30:00', timezone: 'America/Puerto_Rico' } })
    h.write.mockResolvedValue({ data: { id: 4, uuid: 'u' } })
    const response = await POST(request({ action: 'schedule', dateTime: '2099-10-22T18:30', expected: { draft: true, publicationDate: h.remote.publicationDate.dateTime, text: 'Caption' } }))
    expect(await response.json()).toMatchObject({ ok: true, confirmed: true })
    expect(h.write).toHaveBeenCalledWith(4, '1', expect.objectContaining({ draft: false, autoPublish: true, publicationDate: { dateTime: '2099-10-22T18:30:00', timezone: 'America/Puerto_Rico' } }))
    expect(h.persist).toHaveBeenCalledWith(expect.objectContaining({ publish_date: '2099-10-22' }))
    expect(h.activity).toHaveBeenCalledWith([expect.objectContaining({ content_idea_id: 'idea-1', metadata: expect.objectContaining({ draft: false, autoPublish: true, metricoolPostId: 4 }) })])
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
    expect(h.activity).not.toHaveBeenCalled()
  })
})
describe('deleting drafts from the calendar', () => {
  const del = (extra = {}) => request({ action: 'delete', expected: { draft: true, publicationDate: '2026-10-20T10:00:00', text: 'Caption' }, ...extra })
  it('deletes a draft in Metricool and unlinks it from its dashboard idea', async () => {
    h.read.mockResolvedValueOnce({ ...h.remote, draft: true, autoPublish: false })
    h.del.mockResolvedValue({ deleted: true })
    const response = await POST(del())
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, confirmed: true, action: 'delete', postId: 4 })
    expect(h.del).toHaveBeenCalledWith(4, '1')
    expect(h.write).not.toHaveBeenCalled()
    expect(h.persist).toHaveBeenCalledWith({ metricool_post_id: null, metricool_uuid: null, posting_started_at: null })
    expect(h.activity).toHaveBeenCalledWith([expect.objectContaining({ content_idea_id: 'idea-1', metadata: expect.objectContaining({ source: 'posting_calendar', deleted: true, metricoolPostId: 4 }) })])
  })
  it('requires the delete-draft permission', async () => {
    h.deleteAllowed = false
    expect((await POST(del())).status).toBe(403)
    expect(h.read).not.toHaveBeenCalled()
    expect(h.del).not.toHaveBeenCalled()
  })
  it('never deletes a post that is scheduled in Metricool', async () => {
    h.read.mockResolvedValueOnce(h.remote)
    expect((await POST(del({ expected: { draft: false, publicationDate: '2026-10-20T10:00:00', text: 'Caption' } }))).status).toBe(409)
    expect(h.del).not.toHaveBeenCalled()
  })
  it('refuses when the draft changed in Metricool since it was loaded', async () => {
    h.read.mockResolvedValueOnce({ ...h.remote, draft: true, text: 'Otro texto' })
    expect((await POST(del())).status).toBe(409)
    expect(h.del).not.toHaveBeenCalled()
  })
  it('reports a definite refusal without marking the outcome uncertain', async () => {
    h.read.mockResolvedValueOnce({ ...h.remote, draft: true })
    h.del.mockRejectedValue(Object.assign(new Error('405'), { unsupportedDelete: true }))
    const response = await POST(del())
    expect(response.status).toBe(409)
    expect(await response.json()).not.toHaveProperty('uncertain')
    expect(h.persist).not.toHaveBeenCalled()
  })
  it('asks to verify when the delete outcome is unknown', async () => {
    h.read.mockResolvedValueOnce({ ...h.remote, draft: true })
    h.del.mockRejectedValue(new Error('timeout'))
    const response = await POST(del())
    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({ uncertain: true })
    expect(h.persist).not.toHaveBeenCalled()
  })
})
