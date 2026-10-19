import { beforeEach, expect, it, vi } from 'vitest'
const h = vi.hoisted(() => ({ permission: vi.fn(), update: vi.fn(), filters: [] as Array<[string, unknown]>, result: { data: [{ id: 'i' }], error: null } as { data: { id: string }[] | null; error: { message: string } | null } }))
vi.mock('@/lib/auth/server', () => ({ requirePermission: h.permission }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: () => ({ update: (data: unknown) => { h.update(data); const chain = { eq: (column: string, value: unknown) => { h.filters.push([column, value]); return chain }, select: async () => h.result }; return chain } }) }) }))
import { setReciboCalendarHidden } from './recibo-calendar-hide'
beforeEach(() => { vi.resetAllMocks(); h.filters = []; h.result = { data: [{ id: 'i' }], error: null } })

it('removes a piece from the calendar without deleting it or touching Metricool', async () => {
  expect(await setReciboCalendarHidden({ ideaId: 'i', clientId: 'c', hidden: true })).toEqual({ ok: true })
  expect(h.permission).toHaveBeenCalledWith('posting.calendar.hide')
  expect(h.update).toHaveBeenCalledWith({ calendar_hidden_at: expect.any(String) })
  expect(h.filters).toEqual([['id', 'i'], ['client_id', 'c']])
})
it('puts a piece back in the calendar', async () => {
  expect(await setReciboCalendarHidden({ ideaId: 'i', clientId: 'c', hidden: false })).toEqual({ ok: true })
  expect(h.update).toHaveBeenCalledWith({ calendar_hidden_at: null })
})
it('denies without permission before writing', async () => {
  h.permission.mockRejectedValue(Error('No autorizado'))
  expect(await setReciboCalendarHidden({ ideaId: 'i', clientId: 'c', hidden: true })).toHaveProperty('error')
  expect(h.update).not.toHaveBeenCalled()
})
it('reports a piece of another client or a missing row', async () => {
  h.result = { data: [], error: null }
  expect(await setReciboCalendarHidden({ ideaId: 'i', clientId: 'other', hidden: true })).toHaveProperty('error')
})
it('explains when the database column is not available yet', async () => {
  h.result = { data: null, error: { message: 'column "calendar_hidden_at" does not exist' } }
  expect((await setReciboCalendarHidden({ ideaId: 'i', clientId: 'c', hidden: true })).error).toMatch(/migración/i)
})
