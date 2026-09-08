import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GraphicGenerator } from './graphic-generator'
import type { GeneratedGraphicRow } from '@/lib/supabase/types'

const auth = vi.hoisted(() => ({ role: 'owner' as string | null }))
vi.mock('@/lib/context/auth-context', () => ({ useAuth: () => ({ role: auth.role }) }))
beforeEach(() => { auth.role = 'owner' })

const enhanceGraphicConcept = vi.fn(async () => ({ concept: 'Descripción rica y detallada "2X1 SOLO SÁB Y DOM"' }))
vi.mock('@/lib/actions/graphics', () => ({
  generateClientGraphics: vi.fn(async () => ({ images: [], model: 'test' })),
  enhanceGraphicConcept: (...args: unknown[]) => enhanceGraphicConcept(...(args as [])),
}))

const clients = [{ id: 'c1', name: 'Barbería El Jefe' }]

const historyRow: GeneratedGraphicRow = {
  id: 'g1',
  client_id: 'c1',
  generated_by: null,
  concept: 'Promo 2x1',
  prompt: null,
  aspect_ratio: '1:1',
  model: 'grok-imagine-image-2.0',
  image_url: 'https://example.com/g1.png',
  storage_path: null,
  source_image_url: null,
  created_at: '2026-09-01T12:00:00Z',
  client: { id: 'c1', name: 'Barbería El Jefe' },
}

describe('GraphicGenerator', () => {
  it.each(['editor', 'video', 'disenador', 'copy', 'team_member', null])('hides image cost for %s', (role) => {
    auth.role = role
    render(<GraphicGenerator clients={clients} history={[]} />)
    expect(screen.queryByText('~$0.04 por imagen')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Generar con IA/ })).toBeInTheDocument()
  })
  it.each(['owner', 'supervisor'])('shows image cost for admin %s', (role) => {
    auth.role = role
    render(<GraphicGenerator clients={clients} history={[]} />)
    expect(screen.getByText('~$0.04 por imagen')).toBeInTheDocument()
  })
  it('renders the form and disables Generar until client + concept are set', () => {
    render(<GraphicGenerator clients={clients} history={[]} />)
    expect(screen.getByText('Nueva gráfica')).toBeInTheDocument()
    expect(screen.getByText('~$0.04 por imagen')).toBeInTheDocument()
    const btn = screen.getByRole('button', { name: /Generar con IA/ })
    expect(btn).toBeDisabled()
  })

  it('ofrece Mejorar descripción, con el mismo gating que Generar (cliente + idea)', () => {
    render(<GraphicGenerator clients={clients} history={[]} />)
    const btn = screen.getByRole('button', { name: /Mejorar descripción/ })
    expect(btn).toBeInTheDocument()
    expect(btn).toBeDisabled() // sin cliente ni idea todavía
    expect(enhanceGraphicConcept).not.toHaveBeenCalled()
  })

  it('offers attaching an own photo as the base for the graphic', () => {
    render(<GraphicGenerator clients={clients} history={[]} />)
    expect(screen.getByText(/Foto propia/)).toBeInTheDocument()
    expect(screen.getByText(/Subir foto/)).toBeInTheDocument()
  })

  it('shows an empty-state message without history', () => {
    render(<GraphicGenerator clients={clients} history={[]} />)
    expect(screen.getByText(/Aún no hay gráficas generadas/)).toBeInTheDocument()
  })

  it('renders history thumbnails with client name', () => {
    render(<GraphicGenerator clients={clients} history={[historyRow]} />)
    expect(screen.getByAltText('Promo 2x1')).toBeInTheDocument()
    expect(screen.getByText(/Barbería El Jefe ·/)).toBeInTheDocument()
  })
})
