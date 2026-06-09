import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import type { IdeaWithPipeline } from '@/lib/supabase/types'

const moveBatch = vi.fn<(...a: unknown[]) => Promise<{ success?: boolean; error?: string }>>(async () => ({ success: true }))
vi.mock('@/lib/actions/content-ideas', () => ({ moveBatch: (...a: unknown[]) => moveBatch(...a) }))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
const push = vi.fn()
const replace = vi.fn()
let mockSearch = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => '/pipeline',
  useSearchParams: () => new URLSearchParams(mockSearch),
}))
vi.mock('./new-video-dialog', () => ({ NewVideoDialog: () => <button>Nuevo video</button> }))
const getClientBatchData = vi.fn(async (..._a: unknown[]) => ({ pipeline: { client: { id: 'x', name: 'X' }, videos: [], assets: [] }, plannedSlots: [] }))
vi.mock('@/lib/actions/client-batch', () => ({ getClientBatchData: (...a: unknown[]) => getClientBatchData(...a) }))
vi.mock('@/components/clients/batch/client-batch-view', () => ({ ClientBatchView: () => <div data-testid="batch-overlay">overlay</div> }))

import { ContentPipelineBoard, type PlannedClient } from './content-pipeline-board'
import { AuthProvider } from '@/lib/context/auth-context'

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
  moveBatch.mockClear()
  moveBatch.mockResolvedValue({ success: true })
  push.mockClear()
  replace.mockClear()
  mockSearch = ''
})

describe('ContentPipelineBoard — batch model', () => {
  it('renders all 7 columns with Idea first and Title second', () => {
    render(<ContentPipelineBoard ideas={[idea()]} />)
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings).toEqual(['Idea', 'Title', 'Caption', 'Video', 'Edited', 'Approval', 'Publication'])
  })

  it('shows one batch card per client (not per video)', () => {
    const { container } = render(<ContentPipelineBoard ideas={[idea({ id: '1' }), idea({ id: '2' }), idea({ id: '3' })]} />)
    const cards = container.querySelectorAll('article')
    expect(cards).toHaveLength(1)
    expect(cards[0].textContent).toContain('Nora Fitness')
    expect(cards[0].textContent).toMatch(/3 videos en el batch/i)
  })

  it('places the batch in the column of its least-advanced video', () => {
    const { container } = render(<ContentPipelineBoard ideas={[idea({ id: '1', status: 'producida' }), idea({ id: '2', status: 'grabada' })]} />)
    // least advanced is grabada → Video column (4th section)
    const videoCol = container.querySelectorAll('section')[3]
    expect(videoCol.textContent).toContain('Nora Fitness')
  })

  it('shows the assignee filter and filters by person', () => {
    const { container } = render(<ContentPipelineBoard ideas={[
      idea({ id: '1', client_id: 'c1', assignee: { id: 'u1', full_name: 'María R.' } }),
      idea({ id: '2', client_id: 'c2', client: { id: 'c2', name: 'Lumen', industry: null }, assignee: { id: 'u2', full_name: 'Diego V.' } }),
    ] as IdeaWithPipeline[]} />)
    expect(screen.getByText(/asignado a/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /maría r/i }))
    const cardsText = Array.from(container.querySelectorAll('article')).map((c) => c.textContent).join('|')
    expect(cardsText).toContain('Nora Fitness')
    expect(cardsText).not.toContain('Lumen')
  })

  it('builds an assignee chip for a NON-dominant assignee (not just the batch owner)', () => {
    // One client batch: 2 videos for María (dominant) + 1 for Diego (non-dominant).
    render(<ContentPipelineBoard ideas={[
      idea({ id: '1', client_id: 'c1', assignee: { id: 'u1', full_name: 'María R.' } }),
      idea({ id: '2', client_id: 'c1', assignee: { id: 'u1', full_name: 'María R.' } }),
      idea({ id: '3', client_id: 'c1', assignee: { id: 'u2', full_name: 'Diego V.' } }),
    ] as IdeaWithPipeline[]} />)
    // Diego has a clickable chip even though he's not the batch's dominant owner.
    expect(screen.getByRole('button', { name: /diego v/i })).toBeInTheDocument()
  })

  it('shows an "Atrasado" badge on a batch card with an overdue video', () => {
    const { container } = render(<ContentPipelineBoard ideas={[
      idea({ id: '1', client_id: 'c1', status: 'grabada', deadline: '2020-01-01' }),
    ] as IdeaWithPipeline[]} />)
    const card = container.querySelector('article')!
    expect(card.textContent).toContain('Atrasado')
  })

  it('moves the whole batch forward, persisting all its videos', async () => {
    render(<ContentPipelineBoard ideas={[idea({ id: '1' }), idea({ id: '2' })]} />)
    fireEvent.click(screen.getByRole('button', { name: /mover batch adelante/i }))
    await waitFor(() => expect(moveBatch).toHaveBeenCalledWith(['1', '2'], 'title'))
  })

  it('shows "Sin asignar" for an unassigned batch', () => {
    render(<ContentPipelineBoard ideas={[idea()]} />)
    expect(screen.getByText(/sin asignar/i)).toBeInTheDocument()
  })

  it('initializes the assignee filter from the URL (?persona=)', () => {
    mockSearch = 'persona=u1'
    const { container } = render(<ContentPipelineBoard ideas={[
      idea({ id: '1', client_id: 'c1', assignee: { id: 'u1', full_name: 'María R.' } }),
      idea({ id: '2', client_id: 'c2', client: { id: 'c2', name: 'Lumen', industry: null }, assignee: { id: 'u2', full_name: 'Diego V.' } }),
    ] as IdeaWithPipeline[]} />)
    const cardsText = Array.from(container.querySelectorAll('article')).map((c) => c.textContent).join('|')
    expect(cardsText).toContain('Nora Fitness')
    expect(cardsText).not.toContain('Lumen')
  })

  it('shows an empty state with a clear-filters action when filters match nothing', () => {
    mockSearch = 'persona=ghost' // nobody has this assignee
    render(<ContentPipelineBoard ideas={[idea({ id: '1', assignee: { id: 'u1', full_name: 'María R.' } })]} />)
    expect(screen.getByText(/ningún batch coincide|no tienes videos asignados/i)).toBeInTheDocument()
    const clear = screen.getByRole('button', { name: /quitar filtros/i })
    fireEvent.click(clear)
    // After clearing, the batch is visible again.
    expect(screen.getByText('Nora Fitness')).toBeInTheDocument()
  })

  it('exposes the scroll region as a keyboard-focusable, labelled group', () => {
    render(<ContentPipelineBoard ideas={[idea()]} />)
    const el = document.querySelector('[data-testid="pipeline-scroll"]') as HTMLElement
    expect(el.getAttribute('tabindex')).toBe('0')
    expect(el.getAttribute('aria-label')).toMatch(/flechas/i)
  })

  it('shows the per-client status badge and the per-video status breakdown', () => {
    const { container } = render(<ContentPipelineBoard ideas={[
      idea({ id: '1', status: 'producida', client: { id: 'c1', name: 'Nora Fitness', industry: null, platforms: ['instagram'], status: 'paused' } }),
      idea({ id: '2', status: 'grabada', client: { id: 'c1', name: 'Nora Fitness', industry: null, platforms: ['instagram'], status: 'paused' } }),
    ] as IdeaWithPipeline[]} />)
    const card = container.querySelector('article')!
    expect(card.textContent).toContain('Pausado')           // client status badge
    expect(card.textContent).toMatch(/Edición\s*1/)          // one video in Edición
    expect(card.textContent).toMatch(/Video\s*1/)            // one video in Video
  })

  it('"Mis videos" filters to batches that have a video assigned to the current user', () => {
    const ideas = [
      idea({ id: '1', client_id: 'c1', assignee: { id: 'me', full_name: 'Yo' } }),
      idea({ id: '2', client_id: 'c2', client: { id: 'c2', name: 'Lumen', industry: null }, assignee: { id: 'other', full_name: 'Otro' } }),
    ] as IdeaWithPipeline[]
    const { container } = render(
      <AuthProvider value={{ user: { id: 'me', email: 'me@x.com' }, profile: null, role: 'owner' }}>
        <ContentPipelineBoard ideas={ideas} />
      </AuthProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /mis videos/i }))
    const cardsText = Array.from(container.querySelectorAll('article')).map((c) => c.textContent).join('|')
    expect(cardsText).toContain('Nora Fitness')
    expect(cardsText).not.toContain('Lumen')
  })

  it('opens the client batch overlay in place on card click (no navigation)', async () => {
    getClientBatchData.mockClear()
    const { container } = render(<ContentPipelineBoard ideas={[idea({ client_id: 'c9', client: { id: 'c9', name: 'Acme', industry: null } })]} />)
    fireEvent.click(container.querySelector('article')!)
    expect(getClientBatchData).toHaveBeenCalledWith('c9')
    expect(push).not.toHaveBeenCalled()
    expect(await screen.findByTestId('batch-overlay')).toBeInTheDocument()
  })
})

describe('ContentPipelineBoard — planned sessions (empty slots)', () => {
  const planned: PlannedClient[] = [
    {
      clientId: 'nd',
      clientName: 'Nathandavidts._',
      platforms: ['instagram'],
      sessions: [
        { index: 0, label: 'Sesión 1', total: 15, filled: 0, empty: 15 },
        { index: 1, label: 'Sesión 2', total: 15, filled: 0, empty: 15 },
      ],
    },
  ]

  it('renders one planned card per session with empty-slot counts', () => {
    render(<ContentPipelineBoard ideas={[]} plannedClients={planned} />)
    expect(screen.getAllByText('Nathandavidts._')).toHaveLength(2)
    expect(screen.getByText(/Sesión 1 · 15 videos/)).toBeInTheDocument()
    expect(screen.getByText(/Sesión 2 · 15 videos/)).toBeInTheDocument()
    expect(screen.getAllByText('15 por idear')).toHaveLength(2)
    expect(screen.getAllByText('Planificado')).toHaveLength(2)
  })

  it('opens the client batch overlay when a planned card is clicked', async () => {
    getClientBatchData.mockClear()
    const { container } = render(<ContentPipelineBoard ideas={[]} plannedClients={planned} />)
    fireEvent.click(container.querySelector('article')!)
    expect(getClientBatchData).toHaveBeenCalledWith('nd')
    // Let the async openClientBatch state update settle (avoids act() warnings).
    await screen.findByTestId('batch-overlay')
  })
})

describe('ContentPipelineBoard — client dropdown filter (replaces chip row)', () => {
  const twoClients = [
    idea({ id: '1', client_id: 'c1' }),
    idea({ id: '2', client_id: 'c2', client: { id: 'c2', name: 'Lumen', industry: null } }),
  ] as IdeaWithPipeline[]

  it('renders a compact "Todos los clientes" dropdown trigger, closed by default', () => {
    render(<ContentPipelineBoard ideas={twoClients} />)
    expect(screen.getByRole('button', { name: /todos los clientes/i })).toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('opens the list with every client + count and filters the board on select', () => {
    const { container } = render(<ContentPipelineBoard ideas={twoClients} />)
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
    const { container } = render(<ContentPipelineBoard ideas={twoClients} />)
    fireEvent.click(screen.getByRole('button', { name: /todos los clientes/i }))
    fireEvent.click(screen.getByRole('option', { name: /lumen/i }))
    fireEvent.click(screen.getByRole('button', { name: /quitar filtro de cliente/i }))
    const cardsText = Array.from(container.querySelectorAll('article')).map((c) => c.textContent).join('|')
    expect(cardsText).toContain('Nora Fitness')
    expect(cardsText).toContain('Lumen')
  })

  it('still shows the batches/publicados stats line', () => {
    render(<ContentPipelineBoard ideas={twoClients} />)
    expect(screen.getByText(/publicados/i)).toBeInTheDocument()
  })
})

describe('ContentPipelineBoard — drag-to-scroll columns (grab cursor)', () => {
  function scrollEl() {
    return document.querySelector('[data-testid="pipeline-scroll"]') as HTMLElement
  }

  it('shows a grab cursor at rest and grabbing while dragging horizontally', () => {
    render(<ContentPipelineBoard ideas={[idea()]} />)
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
    render(<ContentPipelineBoard ideas={[idea()]} />)
    const el = scrollEl()
    fireEvent.mouseDown(el, { button: 0, clientX: 300 })
    fireEvent.mouseUp(el, { clientX: 300 })
    expect(el.className).not.toContain('cursor-grabbing')
  })
})
