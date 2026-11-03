import { render, screen, waitFor, fireEvent, cleanup, act, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const pull = vi.hoisted(() => vi.fn())
vi.mock('@/lib/actions/metricool-calendar-sync', () => ({ pullMetricoolCalendar: (...a: unknown[]) => pull(...a) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/components/auth/role-gate', () => ({ useHasPermission: () => true }))
vi.mock('@/lib/actions/client-cadence', () => ({ updateClientCadence: vi.fn(async () => ({ ok: true })) }))
vi.mock('@/lib/published/calendar-post', async (importOriginal) => ({
  ...await importOriginal<object>(),
  puertoRicoNow: () => '2026-10-16T20:00:00',
}))

import { ContentCalendar } from './content-calendar'

const client = { id: 'c', name: '643 Sport Bar', metricool_blog_id: '1', posting_days: [0, 1, 2, 3, 4, 5, 6], posting_time: '10:00' }
const scheduled = {
  id: 4,
  uuid: 'u',
  text: 'Oferta de octubre',
  publicationDate: '2026-10-20T10:00:00',
  timezone: 'America/Puerto_Rico',
  platforms: ['instagram'],
  draft: false,
  autoPublish: true,
  media: [],
  clientId: 'c',
  clientName: '643 Sport Bar',
  blogId: '1',
  providerStatuses: ['PENDING'],
}

beforeEach(() => {
  pull.mockReset()
  pull.mockResolvedValue({ ok: true, updated: 1, checked: 3, datesUpdated: 2, unverifiedClients: [] })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ posts: [scheduled], complete: true, checkedAt: new Date().toISOString(), failedClients: [] }),
  }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('runs the Metricool pull from Sincronizar and shows a success toast', async () => {
  render(<ContentCalendar clients={[client]} clientId="c" />)
  await screen.findAllByText('Oferta de octubre')
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sincronizar' })) })
  expect(pull).toHaveBeenCalledTimes(1)
  expect(await screen.findByText(/Sincronizado/)).toBeInTheDocument()
})

it('shows a sync error without hiding the calendar', async () => {
  pull.mockResolvedValue({ ok: false, error: 'Metricool no está configurado.' })
  render(<ContentCalendar clients={[client]} clientId="c" />)
  await screen.findAllByText('Oferta de octubre')
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sincronizar' })) })
  expect(await screen.findByText(/Metricool no está configurado/)).toBeInTheDocument()
  expect(screen.getAllByText('Oferta de octubre').length).toBeGreaterThan(0)
})

it('asks before rescheduling a Metricool card dropped on another day', async () => {
  const fetcher = vi.fn(async (input: RequestInfo, init?: RequestInit) => ({
    ok: true,
    json: async () => String(input).includes('/api/metricool/calendar-state')
      ? { ok: true, confirmed: true, postId: 4 }
      : { posts: [scheduled], complete: true, checkedAt: new Date().toISOString(), failedClients: [] },
    init,
  }))
  vi.stubGlobal('fetch', fetcher)
  const { container } = render(<ContentCalendar clients={[client]} clientId="c" />)
  const card = (await screen.findAllByRole('button', { name: /Oferta de octubre/ })).find((button) => button.closest('[data-calendar-date]'))!
  fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn(), effectAllowed: 'move' } })
  fireEvent.drop(container.querySelector('[data-calendar-date="2026-10-22"]')!)
  expect(fetcher.mock.calls.every((call) => !String(call[0]).includes('/api/metricool/calendar-state'))).toBe(true)
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByText('¿Reprogramar en Metricool?')).toBeInTheDocument()
  expect(within(dialog).getByText(/2026-10-22 · 10:00/)).toBeInTheDocument()
  expect(within(dialog).getByText(/643 Sport Bar/)).toBeInTheDocument()
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Sí, reprogramar' })) })
  await waitFor(() => expect(fetcher.mock.calls.some((call) => String(call[0]).includes('/api/metricool/calendar-state'))).toBe(true))
  const write = fetcher.mock.calls.find((call) => String(call[0]).includes('/api/metricool/calendar-state'))
  expect(write?.[1]?.body).toBeTruthy()
  expect(JSON.parse(String(write?.[1]?.body))).toMatchObject({ action: 'schedule', postId: 4, dateTime: '2026-10-22T10:00' })
})

it('does not write when a Metricool card is dropped on its current day', async () => {
  const { container } = render(<ContentCalendar clients={[client]} clientId="c" />)
  const card = (await screen.findAllByRole('button', { name: /Oferta de octubre/ })).find((button) => button.closest('[data-calendar-date]'))!
  fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn(), effectAllowed: 'move' } })
  fireEvent.drop(container.querySelector('[data-calendar-date="2026-10-20"]')!)
  expect(screen.queryByText('¿Reprogramar en Metricool?')).toBeNull()
  expect(vi.mocked(fetch).mock.calls.every((call) => !String(call[0]).includes('/api/metricool/calendar-state'))).toBe(true)
})
