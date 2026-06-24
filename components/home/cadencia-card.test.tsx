import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import { buildCadencia, type CadenciaClientInput } from '@/lib/utils/cadencia'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

import { CadenciaCard } from './cadencia-card'

const WEEK = ['2026-06-22', '2026-06-23', '2026-06-24', '2026-06-25', '2026-06-26', '2026-06-27', '2026-06-28']
const TODAY = '2026-06-25' // Thursday → getDay() = 4
const NOON = 12 * 60

function client(
  p: Partial<CadenciaClientInput> & Pick<CadenciaClientInput, 'clientId' | 'clientName'>,
): CadenciaClientInput {
  return {
    platforms: [],
    postingTime: null,
    postingDays: [],
    publishedDates: [],
    errorDates: [],
    pendingDates: [],
    liveUrlsByDate: {},
    ...p,
  }
}

// Thursday-centric scenario: 3 clients expect Thu (today), 1 expects Sat.
const CLIENTS: CadenciaClientInput[] = [
  // published today → publicado
  client({ clientId: 'c1', clientName: 'Estancias', postingDays: [4], publishedDates: [TODAY], platforms: ['instagram', 'facebook'] }),
  // expected today, 10:00 already passed at noon → atrasado
  client({ clientId: 'c2', clientName: 'Café', postingDays: [4], postingTime: '10:00', platforms: ['tiktok'] }),
  // expected today, 18:00 not yet → pendiente
  client({ clientId: 'c3', clientName: 'Zen', postingDays: [4], postingTime: '18:00' }),
  // expects Saturday (future) → pendiente that day
  client({ clientId: 'c4', clientName: 'Studio', postingDays: [6] }),
]
const DATA = buildCadencia(CLIENTS, WEEK, TODAY, NOON)

beforeEach(() => refresh.mockClear())
afterEach(() => cleanup())

describe('CadenciaCard', () => {
  it('renders the title and live badge', () => {
    render(<CadenciaCard data={DATA} />)
    expect(screen.getByText('Cadencia')).toBeInTheDocument()
    expect(screen.getByText(/en vivo/i)).toBeInTheDocument()
  })

  it('shows the HOY and ESTA SEMANA ring fractions', () => {
    render(<CadenciaCard data={DATA} />)
    expect(screen.getByText('HOY')).toBeInTheDocument()
    expect(screen.getByText('ESTA SEMANA')).toBeInTheDocument()
    // today 1/3 published (Estancias published; Café overdue; Zen pending)
    expect(screen.getByText('1/3')).toBeInTheDocument()
    // week 1/4 (3 expect Thu + 1 expects Sat; only Estancias published)
    expect(screen.getByText('1/4')).toBeInTheDocument()
  })

  it("summarizes today's pending and overdue counts", () => {
    render(<CadenciaCard data={DATA} />)
    expect(screen.getByText(/1 pendiente/i)).toBeInTheDocument()
    expect(screen.getByText(/1 atrasado/i)).toBeInTheDocument()
  })

  it('defaults the drill-down to today, grouped by client', () => {
    render(<CadenciaCard data={DATA} />)
    expect(screen.getByText(/Jueves · por cliente/i)).toBeInTheDocument()
    expect(screen.getByText('Estancias')).toBeInTheDocument()
    expect(screen.getByText('Café')).toBeInTheDocument()
    // Café is overdue today — scope to the drill-down (the ring sublabel also says "atrasado")
    const drill = screen.getByTestId('cadencia-drilldown')
    expect(within(drill).getByText(/atrasado/i)).toBeInTheDocument()
  })

  it('switches the drill-down when another day is selected', () => {
    render(<CadenciaCard data={DATA} />)
    fireEvent.click(screen.getByRole('button', { name: /Sáb/ }))
    expect(screen.getByText(/Sábado · por cliente/i)).toBeInTheDocument()
    expect(screen.getByText('Studio')).toBeInTheDocument()
  })

  it('shows an empty state for a day with no posts', () => {
    render(<CadenciaCard data={DATA} />)
    fireEvent.click(screen.getByRole('button', { name: /Lun/ }))
    expect(screen.getByText(/Sin publicaciones programadas/i)).toBeInTheDocument()
  })

  it('shows a live-confirmation link when Metricool confirms a post', () => {
    const data = buildCadencia(
      [client({ clientId: 'c1', clientName: 'Estancias', postingDays: [4], publishedDates: [TODAY], liveUrlsByDate: { [TODAY]: ['https://instagram.com/p/abc'] } })],
      WEEK,
      TODAY,
      NOON,
    )
    render(<CadenciaCard data={data} />)
    const link = screen.getByRole('link', { name: /en vivo/i })
    expect(link).toHaveAttribute('href', 'https://instagram.com/p/abc')
  })

  it('flags a failed publish reported by Metricool', () => {
    const data = buildCadencia(
      [client({ clientId: 'c1', clientName: 'Estancias', postingDays: [4], errorDates: [TODAY] })],
      WEEK,
      TODAY,
      NOON,
    )
    render(<CadenciaCard data={data} />)
    const drill = screen.getByTestId('cadencia-drilldown')
    expect(within(drill).getByText(/falló/i)).toBeInTheDocument()
  })

  it('renders all 7 day chips', () => {
    render(<CadenciaCard data={DATA} />)
    for (const label of ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument()
    }
  })
})
