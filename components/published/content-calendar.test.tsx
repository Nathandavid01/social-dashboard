import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ContentCalendar } from './content-calendar'
const date = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Puerto_Rico' })
const base = { id: 1, uuid: 'one', text: 'Oferta de octubre', publicationDate: `${date}T23:59:00`, timezone: 'America/Puerto_Rico', platforms: ['instagram'], draft: false, autoPublish: true, media: [{ url: '/preview.jpg', type: 'image' }], clientName: 'Cliente A', blogId: '1', providerStatuses: ['PENDING'] }
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
describe('visual posting calendar', () => {
  it('loads a month, exposes thumbnails and upcoming posts, and opens post details', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ posts: [base] }) })
    vi.stubGlobal('fetch', fetcher)
    render(<ContentCalendar clients={[]} />)
    await waitFor(() => expect(screen.getAllByText('Oferta de octubre').length).toBeGreaterThan(0))
    expect(fetcher.mock.calls[0][0]).toContain('includeDrafts=true')
    expect(screen.getByRole('heading', { name: 'Próximas publicaciones' })).toBeInTheDocument()
    expect(screen.getAllByRole('img').length).toBeGreaterThan(0)
    fireEvent.click(screen.getAllByRole('button', { name: /Oferta de octubre/ })[0])
    expect(screen.getByRole('dialog')).toHaveTextContent('Cliente A')
  })
  it('shows an actionable empty state and lets the user switch to week view', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ posts: [] }) }))
    render(<ContentCalendar clients={[]} />)
    expect(await screen.findByText('No hay publicaciones en este período.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Semana' }))
    expect(screen.getByRole('button', { name: 'Semana' })).toHaveAttribute('aria-pressed', 'true')
    await screen.findByText('No hay publicaciones en este período.')
  })
  it('reports load failures without showing empty-state counts as real data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    render(<ContentCalendar clients={[]} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar')
    expect(screen.queryByText('No hay publicaciones en este período.')).not.toBeInTheDocument()
  })
})
