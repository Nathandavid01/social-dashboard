import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import type { IdeaWithPipeline } from '@/lib/supabase/types'

const moveBatch = vi.fn<(...a: unknown[]) => Promise<{ success?: boolean; error?: string }>>(async () => ({ success: true }))
vi.mock('@/lib/actions/content-ideas', () => ({ moveBatch: (...a: unknown[]) => moveBatch(...a) }))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('./new-video-dialog', () => ({ NewVideoDialog: () => <button>Nuevo video</button> }))

import { ContentPipelineBoard, type PlannedClient } from './content-pipeline-board'

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

  it('moves the whole batch forward, persisting all its videos', async () => {
    render(<ContentPipelineBoard ideas={[idea({ id: '1' }), idea({ id: '2' })]} />)
    fireEvent.click(screen.getByRole('button', { name: /mover batch adelante/i }))
    await waitFor(() => expect(moveBatch).toHaveBeenCalledWith(['1', '2'], 'title'))
  })

  it('shows "Sin asignar" for an unassigned batch', () => {
    render(<ContentPipelineBoard ideas={[idea()]} />)
    expect(screen.getByText(/sin asignar/i)).toBeInTheDocument()
  })

  it('navigates to the client batch view on card click', () => {
    const { container } = render(<ContentPipelineBoard ideas={[idea({ client_id: 'c9', client: { id: 'c9', name: 'Acme', industry: null } })]} />)
    fireEvent.click(container.querySelector('article')!)
    expect(push).toHaveBeenCalledWith('/clients/c9/batch')
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

  it('opens the client batch view when a planned card is clicked', () => {
    const { container } = render(<ContentPipelineBoard ideas={[]} plannedClients={planned} />)
    fireEvent.click(container.querySelector('article')!)
    expect(push).toHaveBeenCalledWith('/clients/nd/batch')
  })
})
