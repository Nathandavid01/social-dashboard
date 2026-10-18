import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { buildVideoStock, type StockIdea } from '@/lib/inventario/video-stock-core'
import { lastRawLabel, runOutLabel } from './stock-labels'

// WebGL does not exist in jsdom — the scene has its own test; here we only
// check the view wires selection into it.
const sceneProps = vi.fn()
vi.mock('./video-stock-scene-lazy', () => ({
  VideoStockSceneLazy: (props: { selectedId: string | null }) => {
    sceneProps(props)
    return <div data-testid="scene" data-selected={props.selectedId ?? ''} />
  },
}))

const detailCall = vi.fn()
vi.mock('@/lib/actions/video-stock-detail', () => ({
  getClientStockDetail: async (id: string) => {
    detailCall(id)
    return {
      detail: {
        profile: { id, name: 'Apiario Coffee', logoUrl: null, postingDays: [2, 5], postingTime: null, editorName: null, formats: { 2: 'reel', 5: 'post' } },
        calendar: [],
        upcoming: [{ id: 'p1', title: 'Reel de abejas', stage: 'agendado', format: 'reel', date: '2026-10-16', coverVideoId: null, coverUrl: null }],
        recent: [],
        crudo: 0,
      },
    }
  },
}))

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

import { VideoStockView } from './video-stock-view'

const edited = { kind: 'edited', status: 'uploaded', uploaded_at: '2026-10-09T12:00:00Z' }
const raw = { kind: 'raw', status: 'uploaded', uploaded_at: '2026-10-12T12:00:00Z' }

function stock() {
  const ideas: StockIdea[] = [
    { id: 'a', client_id: 'guira', status: 'grabada', videos: [raw] },
    { id: 'b', client_id: 'guira', status: 'grabada', videos: [raw] },
    ...Array.from({ length: 6 }, (_, n) => ({
      id: `ap${n}`,
      client_id: 'apiario',
      status: 'producida',
      videos: [edited],
    })),
    { id: 'l', client_id: 'lenel', status: 'producida', videos: [edited] },
  ]
  return buildVideoStock(
    [
      { id: 'guira', name: 'La Guira', posting_days: [1, 3, 5] },
      { id: 'apiario', name: 'Apiario Coffee', posting_days: [2, 5], logoUrl: '/api/img-proxy?u=apiario' },
      { id: 'lenel', name: 'Lenel', posting_days: [] },
    ],
    ideas,
    '2026-10-14',
  )
}

describe('VideoStockView', () => {
  it('shows the KPI tiles with the real totals', () => {
    render(<VideoStockView stock={stock()} />)
    expect(screen.getByTestId('kpi-listos')).toHaveTextContent('7')
    expect(screen.getByTestId('kpi-crudo')).toHaveTextContent('2')
    expect(screen.getByTestId('kpi-con-crudo')).toHaveTextContent('1')
    expect(screen.getByTestId('kpi-grabar')).toHaveTextContent('1')
  })

  it('lists every client most-urgent first, with videos left and raw footage', () => {
    render(<VideoStockView stock={stock()} />)
    const rows = screen.getAllByTestId('stock-row')
    expect(rows.map((r) => r.getAttribute('data-client'))).toEqual(['guira', 'apiario', 'lenel'])
    const guira = within(rows[0])
    expect(guira.getByText('La Guira')).toBeInTheDocument()
    expect(guira.getByText('Hay que grabar')).toBeInTheDocument()
    expect(guira.getByTestId('row-listos')).toHaveTextContent('0')
    expect(guira.getByTestId('row-crudo')).toHaveTextContent('2')
  })

  it('splits the ready videos into reels and posts on each row', () => {
    render(<VideoStockView stock={stock()} />)
    const apiario = screen.getAllByTestId('stock-row')[1]
    expect(within(apiario).getByTestId('row-split')).toHaveTextContent('6 reels · 0 posts')
  })

  it('says scheduled posts come from the Metricool planner, or warns when it could not be read', () => {
    const { rerender } = render(<VideoStockView stock={{ ...stock(), plannerAvailable: true }} />)
    expect(screen.getByText(/Lo agendado se lee del planificador de Metricool/)).toBeInTheDocument()
    rerender(<VideoStockView stock={{ ...stock(), plannerAvailable: false }} />)
    expect(screen.getByText(/No se pudo leer el planificador de Metricool/)).toBeInTheDocument()
  })

  it('says where the numbers come from (only footage uploaded to the system)', () => {
    render(<VideoStockView stock={stock()} />)
    expect(screen.getByText(/Solo cuenta lo que está subido al sistema/i)).toBeInTheDocument()
  })

  it('filters to the clients that need a recording', () => {
    render(<VideoStockView stock={stock()} />)
    fireEvent.click(within(screen.getByRole('group', { name: 'Filtros' })).getByRole('button', { name: /Hay que grabar/ }))
    expect(screen.getAllByTestId('stock-row').map((r) => r.getAttribute('data-client'))).toEqual(['guira'])
  })

  it('filters to the clients with grabaciones waiting', () => {
    render(<VideoStockView stock={stock()} />)
    fireEvent.click(within(screen.getByRole('group', { name: 'Filtros' })).getByRole('button', { name: /Con grabaciones/ }))
    expect(screen.getAllByTestId('stock-row').map((r) => r.getAttribute('data-client'))).toEqual(['guira'])
  })

  it('selecting a row focuses that client in the 3D scene', () => {
    render(<VideoStockView stock={stock()} />)
    fireEvent.click(screen.getAllByTestId('stock-row')[1])
    expect(screen.getByTestId('scene')).toHaveAttribute('data-selected', 'apiario')
  })

  it('each row shows the client logo, or the initials when there is none', () => {
    render(<VideoStockView stock={stock()} />)
    const [guira, apiario] = screen.getAllByTestId('stock-row')
    expect(within(apiario).getByRole('img', { name: 'Logo de Apiario Coffee' })).toHaveAttribute('src', '/api/img-proxy?u=apiario')
    expect(within(guira).queryByRole('img')).toBeNull()
    expect(within(guira).getByText('LG')).toBeInTheDocument()
  })

  it('a logo that fails to load falls back to the initials', () => {
    render(<VideoStockView stock={stock()} />)
    const apiario = screen.getAllByTestId('stock-row')[1]
    fireEvent.error(within(apiario).getByRole('img', { name: 'Logo de Apiario Coffee' }))
    expect(within(apiario).queryByRole('img')).toBeNull()
    expect(within(apiario).getByText('AC')).toBeInTheDocument()
  })

  it('selecting a client opens its profile with the posts on its calendar', async () => {
    render(<VideoStockView stock={stock()} />)
    fireEvent.click(screen.getAllByTestId('stock-row')[1])
    expect(detailCall).toHaveBeenCalledWith('apiario')
    const panel = await screen.findByRole('complementary', { name: 'Perfil de Apiario Coffee' })
    expect(await within(panel).findByText('Reel de abejas')).toBeInTheDocument()
    fireEvent.click(within(panel).getByRole('button', { name: 'Cerrar perfil' }))
    expect(screen.queryByRole('complementary', { name: 'Perfil de Apiario Coffee' })).toBeNull()
  })

  it('shows an honest empty state when a filter leaves nothing', () => {
    const s = stock()
    s.clients = s.clients.filter((c) => c.clientId === 'apiario')
    render(<VideoStockView stock={s} />)
    fireEvent.click(within(screen.getByRole('group', { name: 'Filtros' })).getByRole('button', { name: /Hay que grabar/ }))
    expect(screen.getByText(/Nadie en este filtro/)).toBeInTheDocument()
  })
})

describe('stock labels', () => {
  it('runOutLabel speaks in days relative to today', () => {
    expect(runOutLabel('2026-10-14', '2026-10-14')).toBe('Hoy no hay video')
    expect(runOutLabel('2026-10-15', '2026-10-14')).toBe('Se acaba mañana')
    expect(runOutLabel('2026-10-16', '2026-10-14')).toBe('Se acaba vie 16 oct')
    expect(runOutLabel(null, '2026-10-14')).toBe('Sin cadencia')
  })

  it('lastRawLabel says when they last recorded', () => {
    expect(lastRawLabel('2026-10-14T03:00:00Z', '2026-10-14')).toBe('Grabó hoy')
    expect(lastRawLabel('2026-10-11T03:00:00Z', '2026-10-14')).toBe('Grabó hace 3 días')
    expect(lastRawLabel(null, '2026-10-14')).toBeNull()
  })
})
