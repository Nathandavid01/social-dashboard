import { render, screen, waitFor, fireEvent, cleanup, within, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ContentCalendar } from './content-calendar'
const date = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Puerto_Rico' })
const base = { id: 1, uuid: 'one', text: 'Oferta de octubre', publicationDate: `${date}T23:59:00`, timezone: 'America/Puerto_Rico', platforms: ['instagram'], draft: false, autoPublish: true, media: [{ url: '/preview.jpg', type: 'image' }], clientName: 'Cliente A', blogId: '1', providerStatuses: ['PENDING'] }
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })
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
  it('provides a right panel with all upcoming posts and clickable state filters', async () => {
    const published = { ...base, id: 2, text: 'Publicación confirmada', providerStatuses: ['PUBLISHED'] }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ posts: [base, published] }) }))
    render(<ContentCalendar clients={[]} />)
    const panel = screen.getByRole('complementary', { name: 'Menú de publicaciones' })
    await waitFor(() => expect(within(panel).getByRole('button', { name: /Publicado/ })).toHaveTextContent('1'))
    fireEvent.click(within(panel).getByRole('button', { name: /Publicado/ }))
    expect(screen.queryByRole('button', { name: /Oferta de octubre/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Publicación confirmada/ })).toBeInTheDocument()
    fireEvent.click(within(panel).getByRole('button', { name: /Todos los estados/ }))
    fireEvent.click(within(panel).getByRole('button', { name: 'Ver todas' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Oferta de octubre')
  })
  it('automatically verifies publishing and updates the calendar and open details', async () => {
    vi.useFakeTimers()
    let published = false
    const fetcher = vi.fn().mockImplementation(async () => ({ ok: true, json: async () => ({ complete: true, checkedAt: new Date().toISOString(), posts: [{ ...base, providerStatuses: [published ? 'PUBLISHED' : 'PENDING'], providers: [{ network: 'instagram', status: published ? 'PUBLISHED' : 'PENDING', publicUrl: published ? 'https://www.instagram.com/p/test/' : undefined }] }] }) }))
    vi.stubGlobal('fetch', fetcher)
    await act(async () => { render(<ContentCalendar clients={[]} />) })
    fireEvent.click(screen.getAllByRole('button', { name: /Oferta de octubre/ })[0])
    published = true
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('dialog')).toHaveTextContent('Publicado')
    expect(screen.getByRole('link', { name: /Ver publicación en instagram/i })).toHaveAttribute('href', 'https://www.instagram.com/p/test/')
    expect(screen.getByText(/Verificado con Metricool/)).toBeInTheDocument()
  })
  it('keeps the last result visible when a later verification fails', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ posts: [base], complete: true, checkedAt: new Date().toISOString() }) }).mockResolvedValueOnce({ ok: false })
    vi.stubGlobal('fetch', fetcher)
    render(<ContentCalendar clients={[]} />)
    await screen.findAllByText('Oferta de octubre')
    fireEvent.click(screen.getByRole('button', { name: 'Verificar con Metricool' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo verificar')
    expect(screen.getAllByText('Oferta de octubre').length).toBeGreaterThan(0)
  })
  it('reports load failures without showing empty-state counts as real data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    render(<ContentCalendar clients={[]} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo verificar')
    expect(screen.queryByText('No hay publicaciones en este período.')).not.toBeInTheDocument()
  })
})

it('opens a client calendar with fixed identity and no all-clients query', async () => {
 const fetcher = vi.fn().mockResolvedValue({ok:true,json:async()=>({posts:[]})})
 vi.stubGlobal('fetch',fetcher)
 render(<ContentCalendar clients={[{id:'c',name:'Cliente A',metricool_blog_id:'1'}]} clientId="c" />)
 await waitFor(()=>expect(fetcher).toHaveBeenCalled())
 expect(fetcher.mock.calls[0][0]).toContain('clientId=c')
 expect(fetcher.mock.calls[0][0]).not.toContain('all=true')
 expect(screen.getByRole('heading', {name:'Calendario de Cliente A'})).toBeInTheDocument()
 expect(screen.queryByRole('combobox',{name:'Filtrar por cliente'})).toBeNull()
})

it('plays an uploaded video in its detail card',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({posts:[{...base,media:[{url:'https://media.example/corte.mp4',type:'video'}]}]})}))
 render(<ContentCalendar clients={[]} />);await screen.findAllByText('Oferta de octubre');fireEvent.click(screen.getAllByRole('button',{name:/Oferta de octubre/})[0])
 expect(screen.getByRole('dialog').querySelector('video')).toHaveAttribute('controls')
})

it('shows each client frequency and marks expected weekdays even when Metricool has no posts',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({posts:[],checkedAt:new Date().toISOString()})}))
 render(<ContentCalendar clients={[{id:'a',name:'Cliente A',metricool_blog_id:'1',posting_days:[1,3,5],posting_time:'10:00'},{id:'b',name:'Cliente B',metricool_blog_id:null,posting_days:[]}]} />)
 const cadence=screen.getByRole('region',{name:'Frecuencia por cliente'})
 expect(within(cadence).getByText('3 días por semana')).toBeInTheDocument();expect(within(cadence).getByText('Sin frecuencia configurada')).toBeInTheDocument()
 await waitFor(()=>expect(screen.getAllByText('Previsto · Cliente A · 10:00').length).toBeGreaterThan(0))
 const marker=screen.getAllByText('Previsto · Cliente A · 10:00')[0]
 const cell=marker.closest('[data-calendar-date]')!
 expect([1,3,5]).toContain(new Date(`${cell.getAttribute('data-calendar-date')}T12:00:00`).getDay())
 expect(screen.queryByText(/Previsto · Cliente B/)).toBeNull()
 fireEvent.click(screen.getByRole('button',{name:'Semana'}));expect(screen.getAllByText('Previsto · Cliente A · 10:00')).toHaveLength(3)
})
