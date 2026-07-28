import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import type { IdeaWithPipeline } from '@/lib/supabase/types'

vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }))
const discardEntregaVideos = vi.fn(async () => ({ ok: true as const, count: 1 }))
vi.mock('@/lib/actions/pipeline-submit', () => ({
  discardEntregaVideos: (...a: unknown[]) => discardEntregaVideos(...(a as [])),
}))
vi.mock('./review-overlay', () => ({ ReviewOverlay: () => <div data-testid="review-overlay">cola</div> }))

import { EntregasBoard, type PlannedClient } from './entregas-board'

function idea(over: Partial<IdeaWithPipeline> = {}): IdeaWithPipeline {
  return {
    id: 'i', client_id: 'c1', content_type: 'R', title: 't',
    hook: null, visual_brief: null, caption_angle: null, hashtags_suggestion: null, rationale: null,
    status: 'idea', production_task_id: null, recording_session_id: null, theme: null,
    generation_prompt: null, model: null, generated_caption: null, caption_platform: null, caption_generated_at: null,
    published_at: null, approval_status: 'pending', approved_by: null, approved_at: null, submitted_at: null,
    recording_date: null, publish_date: null, created_by: null,
    created_at: '2026-06-01', updated_at: '2026-06-01',
    recordingScheduled: false, videos: [], assignee: null,
    client: { id: 'c1', name: 'Nora Fitness', industry: null, platforms: ['instagram'] },
    ...over,
  } as IdeaWithPipeline
}

beforeEach(() => {
  cleanup()
  push.mockClear()
})

describe('EntregasBoard — batch model', () => {
  it('cada tarjeta trae una X para quitarla del tablero', () => {
    render(<EntregasBoard ideas={[idea({ id: '1' })]} />)
    expect(screen.getByRole('button', { name: /quitar Nora Fitness del tablero/i })).toBeInTheDocument()
  })

  it('la X pide confirmación antes de quitar nada', () => {
    render(<EntregasBoard ideas={[idea({ id: '1' })]} />)
    fireEvent.click(screen.getByRole('button', { name: /^quitar Nora Fitness/i }))
    expect(screen.getByRole('button', { name: /confirmar quitar/i })).toBeInTheDocument()
    expect(discardEntregaVideos).not.toHaveBeenCalled()
  })

  it('el segundo click sí la quita', async () => {
    render(<EntregasBoard ideas={[idea({ id: '1' })]} />)
    fireEvent.click(screen.getByRole('button', { name: /^quitar Nora Fitness/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirmar quitar/i }))
    await waitFor(() => expect(discardEntregaVideos).toHaveBeenCalledWith(['1']))
  })

  it('la tarjeta de Publicación dice cuándo cae el borrador en Metricool', () => {
    render(<EntregasBoard
      ideas={[idea({ id: '1', status: 'producida', approval_status: 'approved', generated_caption: 'Copy', publish_date: '2099-07-30' })]}
      postingTimes={{ c1: '14:30' }}
    />)
    expect(screen.getByText(/Borrador en Metricool/i)).toBeInTheDocument()
    expect(screen.getByText(/30 jul 2099 · 14:30/)).toBeInTheDocument()
  })

  it('avisa cuando no hay fecha y Metricool la corre a +24h', () => {
    render(<EntregasBoard
      ideas={[idea({ id: '1', status: 'producida', approval_status: 'approved', generated_caption: 'Copy', publish_date: null })]}
    />)
    expect(screen.getByText(/se corre a \+24h/i)).toBeInTheDocument()
  })

  it('solo las tarjetas de Publicación traen el botón de Metricool', () => {
    render(<EntregasBoard ideas={[
      idea({ id: '1', status: 'producida', approval_status: 'approved', generated_caption: 'Copy listo' }),
      idea({ id: '2', client_id: 'c2', client: { id: 'c2', name: 'Lumen', industry: null },
             status: 'producida', approval_status: 'submitted' }),
    ]} />)
    // Un video aprobado CON copy está en Publicación; el enviado, en Revisión.
    expect(screen.getAllByRole('button', { name: /enviar a metricool/i })).toHaveLength(1)
  })

  it('renders the 4 columns in Spanish with Editado first and Copy after Revisión', () => {
    render(<EntregasBoard ideas={[idea()]} />)
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings).toEqual(['Editado', 'Revisión', 'Copy', 'Publicación'])
  })

  it('la tarjeta lista los títulos de sus videos, no barras vacías', () => {
    const { container } = render(<EntregasBoard ideas={[
      idea({ id: '1', title: 'Rutina de piernas' }),
      idea({ id: '2', title: 'Antes y después' }),
    ]} />)
    const card = container.querySelector('article')!
    expect(card.textContent).toContain('Rutina de piernas')
    expect(card.textContent).toContain('Antes y después')
  })

  it('con más de 3 videos muestra los primeros y cuántos faltan', () => {
    const { container } = render(<EntregasBoard ideas={[
      idea({ id: '1', title: 'Uno' }), idea({ id: '2', title: 'Dos' }),
      idea({ id: '3', title: 'Tres' }), idea({ id: '4', title: 'Cuatro' }),
      idea({ id: '5', title: 'Cinco' }),
    ]} />)
    const card = container.querySelector('article')!
    expect(card.textContent).toContain('Uno')
    expect(card.textContent).toContain('Tres')
    expect(card.textContent).not.toContain('Cuatro')
    expect(card.textContent).toMatch(/\+2 más/)
  })

  it('un video sin título no deja la fila en blanco', () => {
    const { container } = render(<EntregasBoard ideas={[
      idea({ id: '1', title: undefined, hook: null }),
    ]} />)
    expect(container.querySelector('article')!.textContent).toContain('Sin título')
  })

  it('un cliente con videos en dos columnas sale en LAS DOS', () => {
    const { container } = render(<EntregasBoard ideas={[
      idea({ id: '1' }),                                              // edited
      idea({ id: '2', status: 'producida', approval_status: 'submitted' }), // approval
    ]} />)
    const cols = container.querySelectorAll('section')
    const editado = cols[0].textContent ?? ''
    const revision = cols[1].textContent ?? ''
    expect(editado).toContain('Nora Fitness')
    expect(revision).toContain('Nora Fitness')
    // y cada tarjeta cuenta SOLO sus videos
    expect(editado).toMatch(/1 video en el batch/)
    expect(revision).toMatch(/1 video en el batch/)
  })

  it('shows one batch card per client (not per video)', () => {
    const { container } = render(<EntregasBoard ideas={[idea({ id: '1' }), idea({ id: '2' }), idea({ id: '3' })]} />)
    const cards = container.querySelectorAll('article')
    expect(cards).toHaveLength(1)
    expect(cards[0].textContent).toContain('Nora Fitness')
    expect(cards[0].textContent).toMatch(/3 videos en el batch/i)
  })

  it('places the batch in the column of its least-advanced video', () => {
    const { container } = render(<EntregasBoard ideas={[idea({ id: '1', approval_status: 'approved' }), idea({ id: '2', status: 'grabada' })]} />)
    // least advanced is unsent → Editado column (1st section)
    const editedCol = container.querySelectorAll('section')[0]
    expect(editedCol.textContent).toContain('Nora Fitness')
  })

  it('shows the assignee filter and filters by person', () => {
    const { container } = render(<EntregasBoard ideas={[
      idea({ id: '1', client_id: 'c1', assignee: { id: 'u1', full_name: 'María R.' } }),
      idea({ id: '2', client_id: 'c2', client: { id: 'c2', name: 'Lumen', industry: null }, assignee: { id: 'u2', full_name: 'Diego V.' } }),
    ] as IdeaWithPipeline[]} teamMembers={[
      { id: 'u1', name: 'María R.' },
      { id: 'u2', name: 'Diego V.' },
      { id: 'u3', name: 'Nathan Torres' },
    ]} />)
    expect(screen.getByText(/asignado a/i)).toBeInTheDocument()
    const assigneeRow = screen.getByText(/asignado a/i).closest('div')!
    fireEvent.click(within(assigneeRow).getByRole('button', { name: /^Todos$/i }))
    fireEvent.click(screen.getByRole('option', { name: /María R\./i }))
    const cardsText = Array.from(container.querySelectorAll('article')).map((c) => c.textContent).join('|')
    expect(cardsText).toContain('Nora Fitness')
    expect(cardsText).not.toContain('Lumen')
  })

  it('no se mueve arrastrando: en Entregas la tarjeta avanza por una decisión', () => {
    render(<EntregasBoard ideas={[idea({ id: '1' }), idea({ id: '2' })]} />)
    expect(screen.queryByRole('button', { name: /mover batch adelante/i })).toBeNull()
  })

  it('shows "Sin asignar" for an unassigned batch', () => {
    render(<EntregasBoard ideas={[idea()]} />)
    expect(screen.getByText(/sin asignar/i)).toBeInTheDocument()
  })

  it('shows an "Atrasado" badge on a batch card with an overdue video', () => {
    const { container } = render(<EntregasBoard ideas={[
      idea({ id: '1', client_id: 'c1', status: 'grabada', deadline: '2020-01-01' }),
    ] as IdeaWithPipeline[]} />)
    expect(container.querySelector('article')!.textContent).toContain('Atrasado')
  })

  it('al abrir una tarjeta sale la COLA de revisión, no la vista de lote', async () => {
    const { container } = render(<EntregasBoard ideas={[
      idea({ client_id: 'c9', status: 'producida', approval_status: 'submitted', client: { id: 'c9', name: 'Acme', industry: null } }),
    ]} />)
    fireEvent.click(container.querySelector('article')!)
    expect(await screen.findByTestId('review-overlay')).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })
})

describe('EntregasBoard — planned sessions (empty slots)', () => {
  const planned: PlannedClient[] = [
    {
      clientId: 'nd',
      clientName: 'Nathandavidts._',
      logoUrl: 'https://cdn.example/nd-logo.png',
      createdAt: '2026-05-15',
      inColumnSince: '2026-06-14',
      platforms: ['instagram'],
      sessions: [
        { index: 0, label: 'Lun 8 jun', total: 1, filled: 0, empty: 1, publishDate: '2026-06-08' },
      ],
      nextStage: 'edited',
      stepAssignee: { id: 'u1', name: 'Ana Torres' },
    },
  ]

  it('renders one planned card per client for the next single video', () => {
    const { container } = render(<EntregasBoard ideas={[]} plannedClients={planned} />)
    expect(screen.getAllByText('Nathandavidts._')).toHaveLength(1)
    expect(screen.getByText('Lun 8 jun')).toBeInTheDocument()
    expect(screen.getByText('Próxima publicación')).toBeInTheDocument()
    expect(screen.getByText(/desde inicio · .* en esta fila/)).toBeInTheDocument()
    expect(screen.getByText('Planificado')).toBeInTheDocument()
    const thumb = container.querySelector('article img[alt=""]') as HTMLImageElement | null
    expect(thumb?.src).toContain('nd-logo.png')
    expect(screen.getByText('Ana Torres')).toBeInTheDocument()
  })

})

describe('EntregasBoard — client dropdown filter (replaces chip row)', () => {
  const twoClients = [
    idea({ id: '1', client_id: 'c1' }),
    idea({ id: '2', client_id: 'c2', client: { id: 'c2', name: 'Lumen', industry: null } }),
  ] as IdeaWithPipeline[]

  it('renders a compact "Todos los clientes" dropdown trigger, closed by default', () => {
    render(<EntregasBoard ideas={twoClients} />)
    expect(screen.getByRole('button', { name: /todos los clientes/i })).toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('opens the list with every client + count and filters the board on select', () => {
    const { container } = render(<EntregasBoard ideas={twoClients} />)
    fireEvent.click(screen.getByRole('button', { name: /todos los clientes/i }))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /lumen/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('option', { name: /lumen/i }))
    const cardsText = Array.from(container.querySelectorAll('article')).map((c) => c.textContent).join('|')
    expect(cardsText).toContain('Lumen')
    expect(cardsText).not.toContain('Nora Fitness')
    // trigger now reflects the selection and the list is closed
    expect(screen.getByRole('button', { name: 'Lumen' })).toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('clears the filter back to all clients via the clear button', () => {
    const { container } = render(<EntregasBoard ideas={twoClients} />)
    fireEvent.click(screen.getByRole('button', { name: /todos los clientes/i }))
    fireEvent.click(screen.getByRole('option', { name: /lumen/i }))
    fireEvent.click(screen.getByRole('button', { name: /quitar filtro de cliente/i }))
    const cardsText = Array.from(container.querySelectorAll('article')).map((c) => c.textContent).join('|')
    expect(cardsText).toContain('Nora Fitness')
    expect(cardsText).toContain('Lumen')
  })

  it('still shows the batches/publicados stats line', () => {
    render(<EntregasBoard ideas={twoClients} />)
    expect(screen.getByText(/publicados/i)).toBeInTheDocument()
  })
})

describe('EntregasBoard — drag-to-scroll columns (grab cursor)', () => {
  function scrollEl() {
    return document.querySelector('[data-testid="pipeline-scroll"]') as HTMLElement
  }

  it('shows a grab cursor at rest and grabbing while dragging horizontally', () => {
    render(<EntregasBoard ideas={[idea()]} />)
    const el = scrollEl()
    expect(el.className).toContain('cursor-grab')
    expect(el.className).not.toContain('cursor-grabbing')

    fireEvent.mouseDown(el, { button: 0, clientX: 300 })
    fireEvent.mouseMove(el, { clientX: 260 }) // moved 40px ≥ threshold
    expect(el.className).toContain('cursor-grabbing')

    fireEvent.mouseUp(el)
    expect(el.className).not.toContain('cursor-grabbing')
  })

  it('does not enter grabbing state for a click without movement (cards stay clickable)', () => {
    render(<EntregasBoard ideas={[idea()]} />)
    const el = scrollEl()
    fireEvent.mouseDown(el, { button: 0, clientX: 300 })
    fireEvent.mouseUp(el, { clientX: 300 })
    expect(el.className).not.toContain('cursor-grabbing')
  })
})
