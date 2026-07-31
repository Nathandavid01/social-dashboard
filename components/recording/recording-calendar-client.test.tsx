import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

const { updateRecordingSession } = vi.hoisted(() => ({ updateRecordingSession: vi.fn() }))
vi.mock('@/lib/actions/recording-sessions', () => ({
  createRecordingSession: vi.fn(),
  updateRecordingSession,
  deleteRecordingSession: vi.fn(),
}))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
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

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  updateRecordingSession.mockResolvedValue({ success: true })
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

  it('opens the existing edit form from a calendar event detail and saves a time change', async () => {
    render(<RecordingCalendarClient initialSessions={[session({ start_time: '09:30:00' })]} clients={clients} teamMembers={team} clientIdeasMap={{}} />)

    fireEvent.click(screen.getByText('Grabación Nora'))
    fireEvent.click(screen.getByRole('button', { name: /editar sesión/i }))

    expect(screen.getByText('Editar Sesión de Grabación')).toBeInTheDocument()
    const startTime = screen.getByLabelText(/hora de inicio/i)
    expect(startTime).toHaveValue('09:30:00')
    fireEvent.change(startTime, { target: { value: '10:15' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }))

    await waitFor(() => expect(updateRecordingSession).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ start_time: '10:15' }),
    ))
  })
})
