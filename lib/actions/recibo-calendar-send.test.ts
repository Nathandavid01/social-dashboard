import { beforeEach, expect, it, vi } from 'vitest'
const h = vi.hoisted(() => ({ draft: vi.fn(), permission: vi.fn(), has: vi.fn(), read: vi.fn(), apply: vi.fn(), client: { data: { id: 'c', metricool_blog_id: '1' } as Record<string, unknown> | null } }))
vi.mock('./recibo-calendar-draft', () => ({ draftReciboOnDate: h.draft }))
vi.mock('@/lib/auth/server', () => ({ requirePermission: h.permission, currentUserHas: h.has }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/metricool/post', () => ({ getServerConfig: () => ({ userToken: 't', userId: 'u', blogId: 'x' }) }))
vi.mock('@/lib/metricool/scheduler', () => ({ getScheduledPost: h.read }))
vi.mock('@/lib/metricool/calendar-state-apply', () => ({ applyCalendarState: h.apply }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ single: async () => h.client }) }) }) }) }) }))
import { sendReciboOnDate } from './recibo-calendar-send'
const input = { ideaId: 'i', clientId: 'c', videoId: 'v', date: '2099-10-20' }
const draftPost = { id: 44, uuid: 'u-44', draft: true, text: 'Caption', providers: [{ network: 'instagram' }], publicationDate: { dateTime: '2099-10-20T10:00:00', timezone: 'America/Puerto_Rico' } }
beforeEach(() => {
  vi.resetAllMocks(); h.client = { data: { id: 'c', metricool_blog_id: '1' } }
  h.has.mockResolvedValue(true); h.draft.mockResolvedValue({ ok: true, draft: true, postId: 44, uuid: 'u-44' }); h.read.mockResolvedValue(draftPost)
  h.apply.mockResolvedValue({ status: 200, body: { ok: true, confirmed: true, postId: 44, uuid: 'u-44', action: 'schedule' } })
})

it('creates the draft through the Recibo guards, then schedules it at its own date and slot time', async () => {
  expect(await sendReciboOnDate(input)).toEqual({ ok: true, confirmed: true, scheduledFor: '2099-10-20T10:00' })
  expect(h.permission).toHaveBeenCalledWith('posting.publish')
  expect(h.has).toHaveBeenCalledWith('metricool.write')
  expect(h.draft).toHaveBeenCalledWith(input)
  expect(h.read).toHaveBeenCalledWith(expect.objectContaining({ blogId: '1' }), 44)
  expect(h.apply).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ blogId: '1' }), 'c', draftPost, 'schedule', '2099-10-20T10:00')
})
it('never creates anything without publish permission', async () => {
  h.permission.mockRejectedValue(Error('No autorizado'))
  expect(await sendReciboOnDate(input)).toHaveProperty('error')
  expect(h.draft).not.toHaveBeenCalled()
})
it('never creates anything without Metricool write permission', async () => {
  h.has.mockResolvedValue(false)
  expect(await sendReciboOnDate(input)).toHaveProperty('error')
  expect(h.draft).not.toHaveBeenCalled()
})
it('passes through a rejected draft without scheduling', async () => {
  h.draft.mockResolvedValue({ error: 'Cambió el archivo editado.' })
  expect(await sendReciboOnDate(input)).toEqual({ error: 'Cambió el archivo editado.' })
  expect(h.apply).not.toHaveBeenCalled()
})
it('keeps the draft and says so when scheduling is refused', async () => {
  h.apply.mockResolvedValue({ status: 409, body: { error: 'La fecha y hora deben estar en el futuro.' } })
  const result = await sendReciboOnDate(input)
  expect(result).toMatchObject({ draftOnly: true })
  expect(result.error).toMatch(/borrador/i)
})
it('keeps the draft when Metricool returns no id or cannot be read', async () => {
  h.draft.mockResolvedValue({ ok: true, draft: true, postId: null, uuid: 'u' })
  expect(await sendReciboOnDate(input)).toMatchObject({ draftOnly: true })
  h.draft.mockResolvedValue({ ok: true, draft: true, postId: 44, uuid: 'u-44' }); h.read.mockRejectedValue(Error('offline'))
  expect(await sendReciboOnDate(input)).toMatchObject({ draftOnly: true })
  expect(h.apply).not.toHaveBeenCalled()
})
it('reports an unverified schedule as uncertain instead of retrying', async () => {
  h.apply.mockResolvedValue({ status: 502, body: { error: 'No se pudo confirmar el cambio.', uncertain: true } })
  expect(await sendReciboOnDate(input)).toMatchObject({ uncertain: true })
  expect(h.apply).toHaveBeenCalledTimes(1)
})
