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
// Per-video detail sheet (opened on card click). Mock keeps the DOM minimal.
vi.mock('@/components/clients/profile/idea-detail-sheet', () => ({
  IdeaDetailSheet: ({ ideaId, open }: { ideaId: string | null; open: boolean }) =>
    open ? <div data-testid="idea-sheet">{ideaId}</div> : null,
}))

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

describe('ContentPipelineBoard — per-video model', () => {
  it('renders all 7 columns with Idea first and Title second', () => {
    render(<ContentPipelineBoard ideas={[idea()]} />)
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings).toEqual(['Idea', 'Title', 'Caption', 'Video', 'Edited', 'Approval', 'Publication'])
  })

  it('shows a first-run state (not 7 empty columns) when there are no videos at all', () => {
    render(<ContentPipelineBoard ideas={[]} plannedClients={[]} />)
    expect(screen.getByText(/Aún no hay videos en el pipeline/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: 'Idea' })).toBeNull()
  })

  it('shows one card per VIDEO, not per client (3 videos of one client → 3 cards)', () => {
    const { container } = render(<ContentPipelineBoard ideas={[
      idea({ id: '1', title: 'Video A' }),
      idea({ id: '2', title: 'Video B' }),
      idea({ id: '3', title: 'Video C' }),
    ]} />)
    const cards = container.querySelectorAll('article')
    expect(cards).toHaveLength(3)
    const text = Array.from(cards).map((c) => c.textContent).join('|')
    expect(text).toContain('Video A')
    expect(text).toContain('Video B')
    expect(text).toContain('Video C')
  })

  it('places each video in the column of ITS OWN stage', () => {
    const { container } = render(<ContentPipelineBoard ideas={[
      idea({ id: '1', status: 'producida', title: 'Editado YA' }),  // edited → col index 4
      idea({ id: '2', status: 'grabada', title: 'Grabado YA' }),    // video → col index 3
    ]} />)
    const sections = container.querySelectorAll('section')
    expect(sections[3].textContent).toContain('Grabado YA')
    expect(sections[4].textContent).toContain('Editado YA')
  })

  it('shows the client name and content-type on each video card', () => {
    const { container } = render(<ContentPipelineBoard ideas={[idea({ id: '1', content_type: 'R', title: 'Mi Reel' })]} />)
    const card = container.querySelector('article')!
    expect(card.textContent).toContain('Mi Reel')
    expect(card.textContent).toContain('Nora Fitness')
    expect(card.textContent).toMatch(/reel/i)
  })

  it('filters videos by assignee', () => {
    const { container } = render(<ContentPipelineBoard ideas={[
      idea({ id: '1', title: 'V1', assignee: { id: 'u1', full_name: 'María R.' } }),
      idea({ id: '2', title: 'V2', client_id: 'c2', client: { id: 'c2', name: 'Lumen', industry: null }, assignee: { id: 'u2', full_name: 'Diego V.' } }),
    ] as IdeaWithPipeline[]} />)
    expect(screen.getByText(/asignado a/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /maría r/i }))
    const cardsText = Array.from(container.querySelectorAll('article')).map((c) => c.textContent).join('|')
    expect(cardsText).toContain('V1')
    expect(cardsText).not.toContain('V2')
  })

  it('builds a chip for every assignee that has a video', () => {
    render(<ContentPipelineBoard ideas={[
      idea({ id: '1', assignee: { id: 'u1', full_name: 'María R.' } }),
      idea({ id: '2', assignee: { id: 'u2', full_name: 'Diego V.' } }),
    ] as IdeaWithPipeline[]} />)
    expect(screen.getByRole('button', { name: /maría r/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /diego v/i })).toBeInTheDocument()
  })

  it('shows an "Atrasado" badge on a video card with an overdue deadline', () => {
    const { container } = render(<ContentPipelineBoard ideas={[
      idea({ id: '1', status: 'grabada', deadline: '2020-01-01' }),
    ] as IdeaWithPipeline[]} />)
    const card = container.querySelector('article')!
    expect(card.textContent).toContain('Atrasado')
  })

  it('moves a SINGLE video forward (persists only that video)', async () => {
    render(<ContentPipelineBoard ideas={[idea({ id: '1' }), idea({ id: '2' })]} />)
    const fwd = screen.getAllByRole('button', { name: /mover video adelante/i })[0]
    fireEvent.click(fwd)
    await waitFor(() => expect(moveBatch).toHaveBeenCalledWith(['1'], 'title'))
  })

  it('shows "Sin asignar" for an unassigned video', () => {
    render(<ContentPipelineBoard ideas={[idea()]} />)
    expect(screen.getByText(/sin asignar/i)).toBeInTheDocument()
  })

  it('initializes the assignee filter from the URL (?persona=)', () => {
    mockSearch = 'persona=u1'
    const { container } = render(<ContentPipelineBoard ideas={[
      idea({ id: '1', title: 'V1', assignee: { id: 'u1', full_name: 'María R.' } }),
      idea({ id: '2', title: 'V2', client_id: 'c2', client: { id: 'c2', name: 'Lumen', industry: null }, assignee: { id: 'u2', full_name: 'Diego V.' } }),
    ] as IdeaWithPipeline[]} />)
    const cardsText = Array.from(container.querySelectorAll('article')).map((c) => c.textContent).join('|')
    expect(cardsText).toContain('V1')
    expect(cardsText).not.toContain('V2')
  })

  it('shows an empty state with a clear-filters action when filters match nothing', () => {
    mockSearch = 'persona=ghost'
    render(<ContentPipelineBoard ideas={[idea({ id: '1', assignee: { id: 'u1', full_name: 'María R.' } })]} />)
    expect(screen.getByText(/ningún video coincide|no tienes videos asignados/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /quitar filtros/i }))
    expect(screen.getByText('Nora Fitness')).toBeInTheDocument()
  })

  it('exposes the scroll region as a keyboard-focusable, labelled group', () => {
    render(<ContentPipelineBoard ideas={[idea()]} />)
    const el = document.querySelector('[data-testid="pipeline-scroll"]') as HTMLElement
    expect(el.getAttribute('tabindex')).toBe('0')
    expect(el.getAttribute('aria-label')).toMatch(/flechas/i)
  })

  it('"Mis videos" filters to videos assigned to the current user', () => {
    const ideas = [
      idea({ id: '1', title: 'Mio', assignee: { id: 'me', full_name: 'Yo' } }),
      idea({ id: '2', title: 'Ajeno', client_id: 'c2', client: { id: 'c2', name: 'Lumen', industry: null }, assignee: { id: 'other', full_name: 'Otro' } }),
    ] as IdeaWithPipeline[]
    const { container } = render(
      <AuthProvider value={{ user: { id: 'me', email: 'me@x.com' }, profile: null, role: 'owner' }}>
        <ContentPipelineBoard ideas={ideas} />
      </AuthProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /mis videos/i }))
    const cardsText = Array.from(container.querySelectorAll('article')).map((c) => c.textContent).join('|')
    expect(cardsText).toContain('Mio')
    expect(cardsText).not.toContain('Ajeno')
  })

  it('opens the per-video detail sheet on card click (no navigation)', async () => {
    const { container } = render(<ContentPipelineBoard ideas={[idea({ id: 'vid-9', title: 'Click me' })]} />)
    fireEvent.click(container.querySelector('article')!)
    const sheet = await screen.findByTestId('idea-sheet')
    expect(sheet.textContent).toBe('vid-9')
    expect(push).not.toHaveBeenCalled()
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
})

describe('ContentPipelineBoard — client dropdown filter', () => {
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

  it('still shows the videos/publicados stats line', () => {
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
    fireEvent.mouseMove(el, { clientX: 260 })
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
