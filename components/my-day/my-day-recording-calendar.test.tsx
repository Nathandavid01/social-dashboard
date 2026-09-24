import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { currentUserHas, createClient } = vi.hoisted(() => ({
  currentUserHas: vi.fn(),
  createClient: vi.fn(),
}))

vi.mock('@/lib/auth/server', () => ({ currentUserHas }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/components/recording/recording-calendar-client', () => ({
  RecordingCalendarClient: () => <div>Calendario semanal de grabación</div>,
}))

import { MyDayRecordingCalendar } from './my-day-recording-calendar'

afterEach(() => cleanup())

function emptyQuery() {
  const query: Record<string, unknown> = {}
  for (const method of ['select', 'gte', 'lt', 'order', 'eq', 'in']) {
    query[method] = vi.fn(() => query)
  }
  query.then = (resolve: (value: { data: never[]; error: null }) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(resolve)
  return query
}

describe('MyDayRecordingCalendar', () => {
  beforeEach(() => {
    currentUserHas.mockReset()
    createClient.mockReset()
  })

  it('no carga ni muestra el calendario sin permiso para el resumen de operaciones', async () => {
    currentUserHas.mockResolvedValue(false)
    const { container } = render(await MyDayRecordingCalendar())
    expect(container).toBeEmptyDOMElement()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('muestra el calendario semanal a quien tiene acceso al resumen', async () => {
    currentUserHas.mockResolvedValue(true)
    const tables: string[] = []
    createClient.mockResolvedValue({
      from: (table: string) => { tables.push(table); return emptyQuery() },
    })
    render(await MyDayRecordingCalendar())
    expect(screen.getByText('Calendario semanal de grabación')).toBeInTheDocument()
    expect(tables).toEqual(['recording_sessions', 'clients', 'profiles', 'content_ideas'])
  })
})
