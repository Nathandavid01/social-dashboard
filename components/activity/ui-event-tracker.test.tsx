import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { UiEventTracker } from './ui-event-tracker'

const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
vi.stubGlobal('fetch', fetchMock)

vi.mock('next/navigation', () => ({
  usePathname: () => mockPath,
}))

let mockPath = '/home'

beforeEach(() => {
  mockPath = '/home'
  fetchMock.mockClear()
})
afterEach(() => cleanup())

function postedEvents() {
  return fetchMock.mock.calls.flatMap((call) => {
    const init = (call as unknown as [string, RequestInit | undefined])[1]
    if (!init?.body || typeof init.body !== 'string') return []
    const parsed = JSON.parse(init.body) as { events?: { kind: string; label: string; path: string }[] }
    return parsed.events ?? []
  })
}

describe('UiEventTracker', () => {
  it('records a button click on a dashboard page', async () => {
    const { container } = render(
      <div>
        <UiEventTracker />
        <button>Guardar</button>
      </div>,
    )
    fireEvent.click(container.querySelector('button')!)
    fireEvent(window, new Event('pagehide'))
    await Promise.resolve()
    expect(postedEvents().some((e) => e.kind === 'click' && e.label === 'Guardar' && e.path === '/home')).toBe(
      true,
    )
  })

  it('does not record clicks on /actividad', async () => {
    mockPath = '/actividad'
    const { container } = render(
      <div>
        <UiEventTracker />
        <button>Filtro</button>
      </div>,
    )
    fireEvent.click(container.querySelector('button')!)
    fireEvent(window, new Event('pagehide'))
    await Promise.resolve()
    expect(postedEvents().some((e) => e.kind === 'click')).toBe(false)
  })
})