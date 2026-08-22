import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { OnsiteShot } from '@/lib/onsite/shot-types'
import type { OnsiteSession } from '@/lib/actions/onsite'

let canBrief = true
let canRecord = true
let canUpload = true

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock('@/components/auth/role-gate', () => ({
  RoleGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useHasPermission: () => canUpload,
}))

vi.mock('@/lib/actions/onsite', () => ({
  toggleShotRecorded: vi.fn(async () => ({ ok: true })),
  removeShotFromSession: vi.fn(async () => ({ ok: true })),
  updateShotDetails: vi.fn(async () => ({ ok: true })),
  addIdeaToSession: vi.fn(async () => ({ ok: true })),
  generateOnsiteIdeas: vi.fn(async () => ({ created: 2 })),
  checkInOnsite: vi.fn(async () => ({ ok: true })),
  updateOnsiteIdea: vi.fn(async () => ({ ok: true })),
}))

vi.mock('@/components/recording/idea-video-loader', () => ({
  IdeaVideoLoader: ({ ideaTitle }: { ideaTitle?: string }) => <div>Subida {ideaTitle}</div>,
}))

import { OnsiteStudio } from './onsite-studio'

const session = (over: Partial<OnsiteSession> = {}): OnsiteSession => ({
  id: 's1',
  title: 'Grabación',
  date: '2026-08-20',
  clientId: 'c1',
  clientName: 'Blue Chiropractic',
  location: 'Oficina',
  status: 'scheduled',
  perWeek: 3,
  perMonth: 13,
  slotTarget: 20,
  arrivedAt: null,
  arrivedById: null,
  arrivedByName: null,
  ...over,
})

const shot = (over: Partial<OnsiteShot> = {}): OnsiteShot => ({
  id: 'i1',
  title: 'Intro Patricia',
  hook: 'Servicios de la clínica',
  visualBrief: '1. DJI al entrar. 2. Patricia saluda a cámara. 3. Recorre la sala 8s.',
  viralityScore: 8,
  viralityWhy: 'El saludo en el umbral para el scroll en los primeros 2s.',
  referenceUrl: 'https://ref.example',
  shotType: 'dji',
  recorded: false,
  ...over,
})

beforeEach(() => {
  canBrief = true
  canRecord = true
  canUpload = true
})

describe('OnsiteStudio', () => {
  it('agrupa clientes: Hoy primero, Sin cliente al final', () => {
    render(
      <OnsiteStudio
        sessions={[
          session({ id: 'old', date: '2026-05-26', clientId: null, clientName: 'Sin cliente', slotTarget: 0 }),
          session({ id: 's1', date: '2026-08-20', clientName: 'Blue Chiropractic' }),
        ]}
        active={session()}
        shots={[shot()]}
        addable={[]}
        canBrief
        canRecord
        canUpload
        today="2026-08-20"
        currentUserId="u1"
      />,
    )
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings[0]).toBe('Hoy')
    expect(headings.at(-1)).toBe('Sin cliente')
    expect(screen.queryByRole('link', { name: /Sin cliente/ })).not.toBeInTheDocument()
  })

  it('el cliente de la derecha se ve como el abierto en la lista', () => {
    render(
      <OnsiteStudio
        sessions={[
          session({ id: 's1', clientName: 'Blue Chiropractic' }),
          session({ id: 's2', clientName: 'El Truco de Guin', date: '2026-08-19' }),
        ]}
        active={session({ id: 's2', clientName: 'El Truco de Guin', date: '2026-08-19' })}
        shots={[]}
        addable={[]}
        canBrief
        canRecord
        canUpload
        today="2026-08-20"
        currentUserId="u1"
      />,
    )
    const abierto = screen.getByRole('link', { name: /El Truco de Guin/ })
    expect(abierto).toHaveAttribute('aria-current', 'page')
    expect(abierto).toHaveTextContent(/Abierto/)
    expect(screen.getByRole('link', { name: /Blue Chiropractic/ })).not.toHaveAttribute('aria-current')
  })

  it('siempre muestra los huecos en blanco hasta el objetivo — 1 llena y el resto por llenar', () => {
    render(
      <OnsiteStudio
        sessions={[session()]}
        active={session()}
        shots={[shot()]}
        addable={[]}
        canBrief
        canRecord
        canUpload
        today="2026-08-20"
        currentUserId="u1"
      />,
    )
    expect(screen.queryByText(/Todavía no hay ideas/)).not.toBeInTheDocument()
    expect(screen.getAllByLabelText(/por llenar/i)).toHaveLength(19)
    expect(screen.getByLabelText('Idea 02 por llenar')).toBeInTheDocument()
    expect(screen.getByLabelText('Idea 20 por llenar')).toBeInTheDocument()
  })

  it('sin ideas todavía: 20 tarjetas en blanco, no el mensaje vacío', () => {
    render(
      <OnsiteStudio
        sessions={[session()]}
        active={session()}
        shots={[]}
        addable={[]}
        canBrief
        canRecord
        canUpload
        today="2026-08-20"
        currentUserId="u1"
      />,
    )
    expect(screen.queryByText(/Todavía no hay ideas/)).not.toBeInTheDocument()
    expect(screen.getAllByLabelText(/por llenar/i)).toHaveLength(20)
  })

  it('enseña la idea, el conteo y la referencia al equipo de grabación', () => {
    render(
      <OnsiteStudio
        sessions={[session()]}
        active={session()}
        shots={[shot()]}
        addable={[]}
        canBrief={false}
        canRecord
        canUpload
        today="2026-08-20"
        currentUserId="u1"
      />,
    )
    expect(screen.getByDisplayValue('Intro Patricia')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Servicios de la clínica')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Referencia/ })).toHaveAttribute('href', 'https://ref.example')
    expect(screen.getByText(/13\/mes · 20 videos/)).toBeInTheDocument()
    expect(screen.getByText(/DJI al entrar/)).toBeInTheDocument()
    expect(screen.getByText(/8\/10/)).toBeInTheDocument()
    expect(screen.getByText(/saludo en el umbral/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Generar/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Llegué' })).toBeInTheDocument()
    expect(screen.getByLabelText('Título de la idea 1')).toHaveAttribute('readOnly')
    expect(screen.getByLabelText('Hook de la idea 1')).toHaveAttribute('readOnly')
    expect(screen.getByLabelText('Qué grabar en la idea 1')).toHaveAttribute('readOnly')
  })

  it('el admin puede generar las ideas que faltan', async () => {
    const user = userEvent.setup()
    render(
      <OnsiteStudio
        sessions={[session()]}
        active={session()}
        shots={[shot()]}
        addable={[]}
        canBrief
        canRecord
        canUpload
        today="2026-08-20"
        currentUserId="u1"
      />,
    )
    expect(screen.getByRole('button', { name: /Generar 19 ideas con IA/ })).toBeInTheDocument()
    const hookField = screen.getByLabelText('Hook de la idea 1')
    expect(hookField.tagName).toBe('TEXTAREA')
    expect(hookField).toHaveValue('Servicios de la clínica')
    await user.click(screen.getByRole('button', { name: /Generar 19 ideas con IA/ }))
  })

  it('quien graba ve la subida del crudo en la tarjeta, sin abrir el chevron', async () => {
    render(
      <OnsiteStudio
        sessions={[session()]}
        active={session()}
        shots={[shot()]}
        addable={[]}
        canBrief={false}
        canRecord
        canUpload
        today="2026-08-20"
        currentUserId="u1"
      />,
    )
    expect(screen.queryByRole('button', { name: /Generar/ })).not.toBeInTheDocument()
    expect(screen.getByText('Subida Intro Patricia')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir detalle' })).toBeInTheDocument()
  })

  it('la subida usa el título que está escrito, aunque no se haya guardado aún', async () => {
    const user = userEvent.setup()
    render(
      <OnsiteStudio
        sessions={[session()]}
        active={session()}
        shots={[shot({ title: 'Intro Patricia' })]}
        addable={[]}
        canBrief
        canRecord
        canUpload
        today="2026-08-20"
        currentUserId="u1"
      />,
    )
    await user.clear(screen.getByLabelText('Título de la idea 1'))
    await user.type(screen.getByLabelText('Título de la idea 1'), 'El primer sandwich del día')
    expect(screen.getByText('Subida El primer sandwich del día')).toBeInTheDocument()
  })
})
