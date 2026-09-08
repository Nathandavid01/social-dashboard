vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()}),usePathname:()=>'/recording-calendar'}))
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

const { updateRecordingSession, canAssign } = vi.hoisted(() => ({
  updateRecordingSession: vi.fn(),
  canAssign: { current: true },
}))
vi.mock('@/lib/actions/recording-sessions', () => ({
  createRecordingSession: vi.fn(),
  updateRecordingSession,
  deleteRecordingSession: vi.fn(),
}))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('./gps-picker', () => ({ GpsPicker: () => null }))
vi.mock('@/components/auth/role-gate', () => ({
  useCurrentUserId: () => null,
  useHasPermission: (perm: string) => perm === 'recording.brief' && canAssign.current,
  RoleGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { RecordingCalendarClient, namesLookLikeSamePerson, sessionChipClientLabel } from './recording-calendar-client'

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
  canAssign.current = true
  updateRecordingSession.mockResolvedValue({ success: true })
})

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
    expect(screen.getByText('Nora Fitness')).toBeInTheDocument()
    expect(screen.queryByText('Grabación Nora')).not.toBeInTheDocument()
  })

  it('does not show the always-on videographer color legend', () => {
    render(<RecordingCalendarClient initialSessions={[]} clients={clients} teamMembers={team} clientIdeasMap={{}} />)
    expect(screen.queryByText('Videógrafos')).not.toBeInTheDocument()
    expect(screen.queryByText(/conflicto de disponibilidad/i)).not.toBeInTheDocument()
  })

  it('shows an availability selector only when a videographer is double-booked this month', () => {
    render(<RecordingCalendarClient
      initialSessions={[
        session({ id: 's1' }),
        session({ id: 's2', title: 'Segunda toma', client: { id: 'c1', name: 'Nora Fitness' } }),
      ]}
      clients={clients}
      teamMembers={team}
      clientIdeasMap={{}}
    />)
    expect(screen.getByText(/conflicto de disponibilidad/i)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /quién está disponible/i })).toBeInTheDocument()
  })

  it('links the calendar to Google Calendar', () => {
    render(<RecordingCalendarClient initialSessions={[session()]} clients={clients} teamMembers={team} clientIdeasMap={{}} />)
    const link = screen.getByRole('link', { name: /google calendar/i })
    expect(link).toHaveAttribute('href', expect.stringContaining('calendar.google.com'))
  })

  it('el videógrafo ve el conflicto y no cambia disponibilidad', () => {
    canAssign.current = false
    render(<RecordingCalendarClient
      initialSessions={[session({ id: 's1' }), session({ id: 's2', title: 'Segunda toma' })]}
      clients={clients}
      teamMembers={team}
      clientIdeasMap={{}}
    />)
    expect(screen.getByText(/conflicto de disponibilidad/i)).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /quién está disponible/i })).not.toBeInTheDocument()
  })

  it('al elegir quién está disponible, reasigna la sesión extra', async () => {
    render(<RecordingCalendarClient
      initialSessions={[session({ id: 's1' }), session({ id: 's2', title: 'Segunda toma' })]}
      clients={clients}
      teamMembers={team}
      clientIdeasMap={{}}
    />)
    fireEvent.click(screen.getByRole('combobox', { name: /quién está disponible/i }))
    fireEvent.click(screen.getByRole('option', { name: 'Diego V.' }))
    await waitFor(() => expect(updateRecordingSession).toHaveBeenCalledWith(
      's2',
      expect.objectContaining({ videographer_id: 'v2' }),
    ))
  })

  it('toggles to the list view', () => {
    render(<RecordingCalendarClient initialSessions={[session()]} clients={clients} teamMembers={team} clientIdeasMap={{}} />)
    fireEvent.click(screen.getByRole('button', { name: /lista/i }))
    expect(screen.getByText('Grabación Nora')).toBeInTheDocument()
  })

  it('la lista conserva quién va y el lugar', () => {
    render(<RecordingCalendarClient initialSessions={[session({ location: 'Blue Chiropractic' })]} clients={clients} teamMembers={team} clientIdeasMap={{}} />)
    fireEvent.click(screen.getByRole('button',{name:'Lista'}))
    expect(screen.getAllByText('María R.').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Blue Chiropractic')).toBeInTheDocument()
  })

  it('en el chip del día el cliente es el título, sin Recording', () => {
    render(<RecordingCalendarClient initialSessions={[session({ title: 'Blue Chiro - Recording' })]} clients={clients} teamMembers={team} clientIdeasMap={{}} />)
    const clientName = screen.getByText('Nora Fitness')
    expect(clientName).toHaveAttribute('data-slot', 'session-chip-client')
    expect(clientName).toHaveClass('line-clamp-2', 'text-xs', 'font-semibold', 'tracking-tight', 'text-foreground')
    expect(screen.queryByText('Blue Chiro - Recording')).not.toBeInTheDocument()
    expect(screen.queryByText(/recording/i)).not.toBeInTheDocument()
  })

  it('sin nombre de cliente el chip sigue mostrando un fallback visible', () => {
    render(<RecordingCalendarClient
      initialSessions={[session({
        client: { id: 'c1', name: '   ' },
        client_id: null,
        title: 'Recording - ',
        videographer: null,
        videographer_id: null,
        location: null,
      })]}
      clients={clients}
      teamMembers={team}
      clientIdeasMap={{}}
    />)
    const fallback = screen.getByText('Sin Cliente')
    expect(fallback).toHaveAttribute('data-slot', 'session-chip-client')
    expect(fallback).toHaveClass('text-xs', 'font-semibold')
    expect(screen.queryByText(/recording/i)).not.toBeInTheDocument()
  })

  it('si el join del cliente falta, usa el nombre de la lista de clientes', () => {
    render(<RecordingCalendarClient
      initialSessions={[session({ client: null, title: 'Recording - X' })]}
      clients={clients}
      teamMembers={team}
      clientIdeasMap={{}}
    />)
    const clientName = screen.getByText('Nora Fitness')
    expect(clientName).toHaveAttribute('data-slot', 'session-chip-client')
    expect(screen.queryByText(/recording/i)).not.toBeInTheDocument()
  })

  it('si el videógrafo parece el mismo que el cliente, no lo duplica en el chip', () => {
    render(<RecordingCalendarClient
      initialSessions={[session({
        title: 'Recording - Dra. Delian Loyola',
        client: { id: 'c1', name: 'Dra. Delian Loyola' },
        videographer: { id: 'v1', full_name: 'Delian Loyola' },
        location: 'Oficina',
      })]}
      clients={[{ id: 'c1', name: 'Dra. Delian Loyola' }]}
      teamMembers={[{ id: 'v1', full_name: 'Delian Loyola' }]}
      clientIdeasMap={{ c1: [{ id: 'i1', recording_session_id: 's1' } as never] }}
    />)
    expect(screen.getByText('Dra. Delian Loyola')).toBeInTheDocument()
    expect(screen.queryByText('Delian Loyola')).not.toBeInTheDocument()
    expect(screen.queryByText('Oficina')).not.toBeInTheDocument()
    expect(screen.queryByText('1 ideas')).not.toBeInTheDocument()
  })

  it('al pulsar la sesión del día, el admin asigna videógrafo y lugar', async () => {
    render(<RecordingCalendarClient initialSessions={[session({ videographer_id: null, videographer: null, location: null })]} clients={clients} teamMembers={team} clientIdeasMap={{}} />)
    fireEvent.click(screen.getByText('Nora Fitness'))
    expect(screen.getByRole('combobox', { name: /videógrafo/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/lugar/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('combobox', { name: /videógrafo/i }))
    fireEvent.click(screen.getByRole('option', { name: 'Diego V.' }))
    fireEvent.change(screen.getByLabelText(/lugar/i), { target: { value: 'Blue Chiropractic' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar asignación/i }))
    await waitFor(() => expect(updateRecordingSession).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ videographer_id: 'v2', location: 'Blue Chiropractic' }),
    ))
  })

  it('el videógrafo ve quién y dónde, no asigna', () => {
    canAssign.current = false
    render(<RecordingCalendarClient initialSessions={[session({ location: 'Estudio' })]} clients={clients} teamMembers={team} clientIdeasMap={{}} />)
    fireEvent.click(screen.getByText('Nora Fitness'))
    expect(screen.getAllByText('María R.').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Estudio').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByRole('combobox', { name: /videógrafo/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /guardar asignación/i })).not.toBeInTheDocument()
  })

  it('opens the existing edit form from a calendar event detail and saves a time change', async () => {
    render(<RecordingCalendarClient initialSessions={[session({ start_time: '09:30:00' })]} clients={clients} teamMembers={team} clientIdeasMap={{}} />)

    fireEvent.click(screen.getByText('Nora Fitness'))
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

describe('sessionChipClientLabel', () => {
  it('prioriza el nombre del cliente', () => {
    expect(sessionChipClientLabel(session(), clients)).toBe('Nora Fitness')
  })

  it('si el nombre viene vacío, usa título de cliente o Sin Cliente', () => {
    expect(sessionChipClientLabel(session({ client: null, client_id: 'c1' }), clients)).toBe('Nora Fitness')
    expect(sessionChipClientLabel(session({ client: { id: 'c9', name: '' }, client_id: null, title: 'Danny Mudano' }), [])).toBe('Danny Mudano')
    expect(sessionChipClientLabel(session({ client: null, client_id: null, title: 'Recording - Casa Sol' }), [])).toBe('Casa Sol')
    expect(sessionChipClientLabel(session({ client: { name: '  ' }, client_id: null, title: 'Recording' }), [])).toBe('Sin Cliente')
  })
})

describe('namesLookLikeSamePerson', () => {
  it('trata Dra. Delian y Delian Loyola como la misma persona', () => {
    expect(namesLookLikeSamePerson('Delian Loyola', 'Dra. Delian Loyola')).toBe(true)
  })

  it('no junta videógrafo y cliente distintos', () => {
    expect(namesLookLikeSamePerson('María R.', 'Nora Fitness')).toBe(false)
  })
})

it('uses the selected client name as a read-only title and shows the recording target', () => {
  render(<RecordingCalendarClient initialSessions={[session()]} clients={[{id:'c1',name:'Nora Fitness',posting_days:[2,4]}]} teamMembers={team} clientIdeasMap={{}} />)
  fireEvent.click(screen.getByText('Nora Fitness'))
  fireEvent.click(screen.getByRole('button',{name:/editar sesión/i}))
  fireEvent.change(screen.getByLabelText(/fecha/i),{target:{value:'2026-09-08'}})
  expect(screen.getByLabelText(/título de la sesión/i)).toHaveValue('Nora Fitness')
  expect(screen.getByLabelText(/título de la sesión/i)).toHaveAttribute('readonly')
  expect(screen.getByText('14 Videos Para Grabar')).toBeInTheDocument()
})

it('shows recording time and a visible assignment warning in the monthly grid',()=>{
 render(<RecordingCalendarClient initialSessions={[session({start_time:'09:30:00',videographer_id:null,videographer:null})]} clients={clients} teamMembers={team} clientIdeasMap={{}} />)
 expect(screen.getByText('09:30')).toBeInTheDocument()
 expect(screen.queryByText('Asignar Videógrafo')).not.toBeInTheDocument()
 expect(screen.getByLabelText('Asignación Pendiente')).toBeInTheDocument()
 expect(screen.getByRole('button',{name:'Mes Anterior'})).toBeInTheDocument()
 expect(screen.getByRole('button',{name:'Volver A Hoy'})).toBeInTheDocument()
})
it('expands a busy day without opening a new-session form',()=>{
 render(<RecordingCalendarClient initialSessions={[1,2,3,4].map(n=>session({id:`s${n}`,title:`Sesión ${n}`,client_id:null,client:null}))} clients={clients} teamMembers={team} clientIdeasMap={{}} />)
 fireEvent.click(screen.getByRole('button',{name:/ver 1 más/i}))
 expect(screen.getByText('Sesión 4')).toBeInTheDocument()
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('uses an agenda on narrow screens instead of a compressed month grid',()=>{
 const previous=window.matchMedia
 window.matchMedia=vi.fn().mockReturnValue({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()})
 render(<RecordingCalendarClient initialSessions={[session({start_time:'09:30:00'})]} clients={clients} teamMembers={team} clientIdeasMap={{}} />)
 expect(screen.getByText('Tu agenda, día por día')).toBeInTheDocument()
 expect(screen.queryByText('Lun')).not.toBeInTheDocument()
 window.matchMedia=previous
})
it('shows the client editor separately from the videographer',()=>{
 render(<RecordingCalendarClient initialSessions={[session()]} clients={[{id:'c1',name:'nora fitness',assigned_to:'editor1'}]} teamMembers={[...team,{id:'editor1',full_name:'Carlos Villalta'}]} clientIdeasMap={{}} />)
 expect(screen.queryByText('Editor · Carlos Villalta')).not.toBeInTheDocument()
 fireEvent.click(screen.getByText('Nora Fitness'))
 expect(screen.getByText('Editor · Carlos Villalta')).toBeInTheDocument()
})

it('explains that a client link is needed before resolving its editor',()=>{
 render(<RecordingCalendarClient initialSessions={[session({client_id:null,client:null})]} clients={clients} teamMembers={team} clientIdeasMap={{}} />)
 fireEvent.click(screen.getByRole('button',{name:'Lista'}))
 expect(screen.getByText('Editor · Vincula El Cliente')).toBeInTheDocument()
})
