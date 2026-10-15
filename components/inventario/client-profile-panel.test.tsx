import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { buildVideoStock } from '@/lib/inventario/video-stock-core'
import { buildClientDetail } from '@/lib/inventario/client-detail-core'
import type { ClientStockDetail } from '@/lib/inventario/client-detail-types'
import { ClientProfilePanel } from './client-profile-panel'

const today = '2026-10-14'
const stock = buildVideoStock(
  [{ id: 'c1', name: 'La Guira', posting_days: [1, 3, 5] }],
  [
    { id: 'l', client_id: 'c1', status: 'producida', videos: [{ kind: 'edited', status: 'uploaded' }] },
    { id: 'r', client_id: 'c1', status: 'grabada', videos: [{ kind: 'raw', status: 'uploaded' }] },
  ],
  today,
).clients[0]

function detail(): ClientStockDetail {
  const d = buildClientDetail(
    [
      { id: 'ag', title: 'Reel terraza', status: 'producida', metricool_post_id: 3, publish_date: '2026-10-19', videos: [{ id: 'v1', kind: 'edited', status: 'uploaded' }] },
      { id: 'li', title: 'Así se prepara', status: 'producida', videos: [{ id: 'v2', kind: 'edited', status: 'uploaded' }] },
      { id: 'pu', title: 'Publicado ayer', status: 'publicada', published_at: '2026-10-13T12:00:00Z', videos: [] },
      { id: 'po', title: 'Promo del mes', status: 'producida', content_type: 'P', videos: [{ id: 'v3', kind: 'edited', status: 'uploaded' }] },
    ],
    [1, 3, 5],
    today,
    { 1: 'reel', 3: 'post', 5: 'reel' },
  )
  return {
    profile: {
      id: 'c1', name: 'La Guira', logoUrl: null, postingDays: [1, 3, 5], postingTime: '18:00:00', editorName: 'David',
      formats: { 1: 'reel', 3: 'post', 5: 'reel' },
    },
    calendar: d.calendar,
    upcoming: d.upcoming.map((p) => ({ ...p, coverUrl: p.id === 'ag' ? 'https://signed/ag.jpg' : null })),
    recent: d.recent.map((p) => ({ ...p, coverUrl: null })),
    crudo: d.crudo,
  }
}

describe('ClientProfilePanel', () => {
  it('shows who the client is: name, cadence with time, editor', () => {
    render(<ClientProfilePanel client={stock} today={today} detail={detail()} loading={false} error={null} onClose={() => {}} />)
    expect(screen.getByRole('heading', { name: 'La Guira' })).toBeInTheDocument()
    expect(screen.getByText('Publica 6:00 p. m. · Editor: David')).toBeInTheDocument()
  })

  it('shows the counts from the inventory', () => {
    render(<ClientProfilePanel client={stock} today={today} detail={detail()} loading={false} error={null} onClose={() => {}} />)
    expect(screen.getByTestId('profile-listos')).toHaveTextContent('1')
    expect(screen.getByTestId('profile-crudo')).toHaveTextContent('1')
  })

  it('counts the empty posting days of the next two weeks', () => {
    render(<ClientProfilePanel client={stock} today={today} detail={detail()} loading={false} error={null} onClose={() => {}} />)
    // Mon/Wed/Fri over 14 days = 6 posting days; 1 scheduled + 2 projected → 3 empty.
    expect(screen.getByText('3 días sin video en las próximas 2 semanas')).toBeInTheDocument()
  })

  it('shows the cadence day by day with the format each day takes', () => {
    render(<ClientProfilePanel client={stock} today={today} detail={detail()} loading={false} error={null} onClose={() => {}} />)
    const chips = within(screen.getByTestId('profile-cadence')).getAllByRole('listitem').map((li) => li.textContent)
    expect(chips).toEqual(['LunReel', 'MiéPost', 'VieReel'])
  })

  it('splits reels and posts into their own sections, each with day and cover', () => {
    render(<ClientProfilePanel client={stock} today={today} detail={detail()} loading={false} error={null} onClose={() => {}} />)
    const reels = screen.getByRole('region', { name: 'Reels' })
    const posts = screen.getByRole('region', { name: 'Posts' })
    expect(within(reels).getAllByTestId('profile-post').map((i) => i.getAttribute('data-post'))).toEqual(['ag', 'li', 'pu'])
    expect(within(posts).getAllByTestId('profile-post').map((i) => i.getAttribute('data-post'))).toEqual(['po'])
    const [ag, li, pu] = within(reels).getAllByTestId('profile-post')
    expect(within(ag).getByText('Reel terraza')).toBeInTheDocument()
    expect(within(ag).getByText('Agendado · lun 19 oct')).toBeInTheDocument()
    expect(within(ag).getByRole('img')).toHaveAttribute('src', 'https://signed/ag.jpg')
    // Wed 14 is a POST day, so the ready reel waits for Fri 16.
    expect(within(li).getByText('Listo · saldría vie 16 oct')).toBeInTheDocument()
    expect(within(pu).getByText('Publicado · mar 13 oct')).toBeInTheDocument()
    expect(within(posts).getByText('Listo · saldría mié 14 oct')).toBeInTheDocument()
  })

  it('close button clears the selection', () => {
    const onClose = vi.fn()
    render(<ClientProfilePanel client={stock} today={today} detail={detail()} loading={false} error={null} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar perfil' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('while loading, keeps the header and shows a skeleton; on error, says so', () => {
    const { rerender } = render(
      <ClientProfilePanel client={stock} today={today} detail={null} loading error={null} onClose={() => {}} />,
    )
    expect(screen.getByRole('heading', { name: 'La Guira' })).toBeInTheDocument()
    expect(screen.getByTestId('profile-loading')).toBeInTheDocument()
    rerender(<ClientProfilePanel client={stock} today={today} detail={null} loading={false} error="No autorizado" onClose={() => {}} />)
    expect(screen.getByText(/No se pudo cargar el perfil/)).toBeInTheDocument()
  })
})
