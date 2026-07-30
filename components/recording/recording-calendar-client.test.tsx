import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

vi.mock('@/lib/actions/recording-sessions', () => ({
  createRecordingSession: vi.fn(),
  updateRecordingSession: vi.fn(),
  deleteRecordingSession: vi.fn(),
}))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('./session-ideas-panel', () => ({ SessionIdeasPanel: () => null }))
vi.mock('./gps-picker', () => ({ GpsPicker: () => null }))

import { RecordingCalendarClient } from './recording-calendar-client'

const today = new Date()
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function session(over: Record<string, any> = {}): any {
  return {
    id: 's1', session_date: todayStr, title: 'Grabación Nora', client_id: 'c1', videographer_id: 'v1',
    status: 'scheduled', start_time: null, end_time: null, location: null, notes: null,
    address: null, lat: null, lng: null, created_by: null, created_at: todayStr, updated_at: todayStr,
    client: { id: 'c1', name: 'Nora Fitness' }, videographer: { id: 'v1', full_name: 'María R.' },
    ...over,
  }
}

const team = [{ id: 'v1', full_name: 'María R.' }, { id: 'v2', full_name: 'Diego V.' }]
const clients = [{ id: 'c1', name: 'Nora Fitness' }]

beforeEach(() => cleanup())

describe('el día que pulsas es la fecha de la sesión', () => {
  /** Los campos del diálogo se inicializan con useState, que solo lee el valor
   *  una vez. Sin remontarlo, pulsar otro día no cambiaba la fecha. */
  const fecha = (n: number) =>
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`

  it('al pulsar un día, el diálogo abre con ESA fecha', () => {
    render(<RecordingCalendarClient initialSessions={[]} clients={clients} teamMembers={team} clientIdeasMap={{}} />)
    fireEvent.click(screen.getByText('7'))
    expect(screen.getByLabelText(/fecha/i)).toHaveValue(fecha(7))
  })

  it('pulsar otro día actualiza la fecha, no se queda con la primera', () => {
    render(<RecordingCalendarClient initialSessions={[]} clients={clients} teamMembers={team} clientIdeasMap={{}} />)
    fireEvent.click(screen.getByText('7'))
    expect(screen.getByLabelText(/fecha/i)).toHaveValue(fecha(7))
    // Cerrar y elegir otro día: aquí es donde fallaba.
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))
    fireEvent.click(screen.getByText('12'))
    expect(screen.getByLabelText(/fecha/i)).toHaveValue(fecha(12))
  })
})

describe('RecordingCalendarClient — premium redesign', () => {
  it('renders the calendar header and a session in the grid', () => {
    render(<RecordingCalendarClient initialSessions={[session()]} clients={clients} teamMembers={team} clientIdeasMap={{}} />)
    expect(screen.getByText('Calendario de Grabación')).toBeInTheDocument()
    expect(screen.getByText('Grabación Nora')).toBeInTheDocument()
  })

  it('shows a videographer color legend', () => {
    render(<RecordingCalendarClient initialSessions={[]} clients={clients} teamMembers={team} clientIdeasMap={{}} />)
    expect(screen.getByText('Videógrafos')).toBeInTheDocument()
    // each team member appears in the legend
    expect(screen.getAllByText('María R.').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Diego V.').length).toBeGreaterThanOrEqual(1)
  })

  it('toggles to the list view', () => {
    render(<RecordingCalendarClient initialSessions={[session()]} clients={clients} teamMembers={team} clientIdeasMap={{}} />)
    fireEvent.click(screen.getByRole('button', { name: /lista/i }))
    expect(screen.getByText('Grabación Nora')).toBeInTheDocument()
  })
})
