import { beforeEach, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  permission: vi.fn(),
  sync: vi.fn(),
  revalidate: vi.fn(),
}))

vi.mock('@/lib/auth/server', () => ({ requirePermission: h.permission }))
vi.mock('@/lib/metricool/sync', () => ({ runMetricoolPublishedSync: h.sync }))
vi.mock('next/cache', () => ({ revalidatePath: h.revalidate }))

import { pullMetricoolCalendar } from './metricool-calendar-sync'

beforeEach(() => {
  vi.resetAllMocks()
  h.permission.mockResolvedValue(undefined)
  h.sync.mockResolvedValue({
    updated: 1,
    checked: 3,
    datesUpdated: 2,
    unverifiedClients: [{ id: 'c', name: 'La Güira' }],
  })
})

it('requires metricool.read before pulling Metricool into the calendar', async () => {
  h.permission.mockRejectedValue(new Error('Acceso denegado (falta permiso: metricool.read)'))
  const result = await pullMetricoolCalendar()
  expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/permiso|denegado/i) })
  expect(h.sync).not.toHaveBeenCalled()
  expect(h.revalidate).not.toHaveBeenCalled()
})

it('runs the same pull as the cron and refreshes calendar views', async () => {
  const result = await pullMetricoolCalendar()
  expect(h.permission).toHaveBeenCalledWith('metricool.read')
  expect(h.sync).toHaveBeenCalledTimes(1)
  expect(h.revalidate).toHaveBeenCalledWith('/published')
  expect(h.revalidate).toHaveBeenCalledWith('/calendar')
  expect(h.revalidate).toHaveBeenCalledWith('/recibo')
  expect(result).toMatchObject({
    ok: true,
    updated: 1,
    checked: 3,
    datesUpdated: 2,
    unverifiedClients: [{ id: 'c', name: 'La Güira' }],
  })
})

it('surfaces a Metricool failure instead of inventing a successful sync', async () => {
  h.sync.mockResolvedValue({ updated: 0, checked: 0, error: 'Metricool no está configurado.' })
  expect(await pullMetricoolCalendar()).toMatchObject({ ok: false, error: 'Metricool no está configurado.' })
})
