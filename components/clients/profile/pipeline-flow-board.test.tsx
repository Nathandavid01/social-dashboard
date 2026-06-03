import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, within, waitFor, act } from '@testing-library/react'
import type { ContentIdea } from '@/lib/supabase/types'
import {
  PipelineFlowBoard,
  currentStage,
  isOverdue,
  resolveDrop,
  COLUMNS,
} from './pipeline-flow-board'

// ── Mocks ────────────────────────────────────────────────────────────────────

// Capture the DndContext callbacks so we can drive drag-end deterministically
// (jsdom can't compute the rects @dnd-kit needs for real pointer dragging).
let capturedOnDragEnd: ((e: unknown) => void) | null = null
let capturedOnDragStart: ((e: unknown) => void) | null = null
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragEnd, onDragStart }: Record<string, unknown>) => {
    capturedOnDragEnd = onDragEnd as (e: unknown) => void
    capturedOnDragStart = onDragStart as (e: unknown) => void
    return <div data-testid="dnd">{children as React.ReactNode}</div>
  },
  DragOverlay: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  PointerSensor: class {},
  useSensor: () => ({}),
  useSensors: () => [],
  useDraggable: () => ({ attributes: {}, listeners: {}, setNodeRef: () => {}, isDragging: false }),
  useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
}))

// Side panel — render a marker so we can assert it opened with the right id.
vi.mock('./idea-detail-sheet', () => ({
  IdeaDetailSheet: ({ ideaId, open }: { ideaId: string | null; open: boolean }) =>
    open ? <div data-testid="sheet">sheet:{ideaId}</div> : null,
}))

vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

const updateIdeaStatus = vi.fn<(...a: unknown[]) => Promise<{ success?: boolean; error?: string }>>(async () => ({
  success: true,
}))
vi.mock('@/lib/actions/content-ideas', () => ({
  updateIdeaStatus: (...a: unknown[]) => updateIdeaStatus(...a),
}))

const NOW = new Date('2026-05-29T12:00:00Z')

function makeIdea(over: Partial<ContentIdea> = {}): ContentIdea {
  return {
    id: 'idea-1',
    client_id: 'c1',
    content_type: 'R',
    title: 'Un video',
    hook: null, visual_brief: null, caption_angle: null, hashtags_suggestion: null, rationale: null,
    status: 'idea',
    production_task_id: null, recording_session_id: null, theme: null, generation_prompt: null, model: null,
    generated_caption: null, caption_platform: null, caption_generated_at: null,
    published_at: null, approval_status: 'pending', approved_by: null, approved_at: null, submitted_at: null,
    recording_date: null, publish_date: null, created_by: null,
    created_at: '2026-05-28T12:00:00Z',
    updated_at: '2026-05-29T11:00:00Z', // recent by default → not stale
    ...over,
  } as ContentIdea
}

beforeEach(() => {
  cleanup()
  capturedOnDragEnd = null
  capturedOnDragStart = null
  updateIdeaStatus.mockClear()
  updateIdeaStatus.mockResolvedValue({ success: true })
})

// ── Pure helpers ──────────────────────────────────────────────────────────────

describe('currentStage — 1:1 with status', () => {
  it('maps each status to its own column', () => {
    expect(currentStage(makeIdea({ status: 'idea' }))).toBe('idea')
    expect(currentStage(makeIdea({ status: 'asignada' }))).toBe('asignada')
    expect(currentStage(makeIdea({ status: 'grabada' }))).toBe('grabada')
    expect(currentStage(makeIdea({ status: 'producida' }))).toBe('producida')
    expect(currentStage(makeIdea({ status: 'publicada' }))).toBe('publicada')
  })
})

describe('isOverdue', () => {
  it('past publish_date + not published → overdue', () => {
    expect(isOverdue(makeIdea({ status: 'grabada', publish_date: '2026-05-01' }), NOW)).toBe(true)
  })
  it('future publish_date + recent activity → not overdue', () => {
    expect(isOverdue(makeIdea({ status: 'grabada', publish_date: '2026-06-30' }), NOW)).toBe(false)
  })
  it('stale (updated_at older than 7 days) + not published → overdue', () => {
    expect(isOverdue(makeIdea({ status: 'grabada', updated_at: '2026-05-10T12:00:00Z' }), NOW)).toBe(true)
  })
  it('published is never overdue, even with a past publish_date', () => {
    expect(isOverdue(makeIdea({ status: 'publicada', publish_date: '2026-05-01', updated_at: '2026-01-01T00:00:00Z' }), NOW)).toBe(false)
  })
})

describe('resolveDrop', () => {
  const ideas = [makeIdea({ id: 'a', status: 'idea' })]
  it('returns the target status when moving to a different column', () => {
    expect(resolveDrop(ideas, 'a', 'grabada')).toEqual({ ideaId: 'a', targetStatus: 'grabada', needsConfirm: false })
  })
  it('flags needsConfirm when the target is publicada', () => {
    expect(resolveDrop(ideas, 'a', 'publicada')).toMatchObject({ targetStatus: 'publicada', needsConfirm: true })
  })
  it('is a no-op for the same column, unknown column, or missing ids', () => {
    expect(resolveDrop(ideas, 'a', 'idea')).toBeNull()
    expect(resolveDrop(ideas, 'a', 'nope')).toBeNull()
    expect(resolveDrop(ideas, null, 'grabada')).toBeNull()
    expect(resolveDrop(ideas, 'a', null)).toBeNull()
  })
})

// ── Rendering ──────────────────────────────────────────────────────────────────

describe('PipelineFlowBoard rendering', () => {
  it('renders all five workflow columns', () => {
    render(<PipelineFlowBoard ideas={[makeIdea()]} />)
    for (const c of COLUMNS) expect(screen.getByText(c.label)).toBeInTheDocument()
  })

  it('shows the empty state when there are no (non-discarded) videos', () => {
    render(<PipelineFlowBoard ideas={[makeIdea({ status: 'descartada' })]} />)
    expect(screen.getByText(/sin videos en el pipeline/i)).toBeInTheDocument()
  })

  it('places each card in the column matching its status', () => {
    const { container } = render(
      <PipelineFlowBoard ideas={[makeIdea({ id: 'g', title: 'Grabado ya', status: 'grabada' })]} />,
    )
    const col = container.querySelector('[data-stage="grabada"]') as HTMLElement
    expect(within(col).getByText('Grabado ya')).toBeInTheDocument()
  })

  it('excludes descartada videos', () => {
    render(
      <PipelineFlowBoard
        ideas={[makeIdea({ id: 'a', title: 'Vivo' }), makeIdea({ id: 'd', title: 'Descartado', status: 'descartada' })]}
      />,
    )
    expect(screen.getByText('Vivo')).toBeInTheDocument()
    expect(screen.queryByText('Descartado')).not.toBeInTheDocument()
  })

  it('flags an overdue card with a ⚠ (aria-label "atrasado")', () => {
    render(<PipelineFlowBoard ideas={[makeIdea({ status: 'grabada', publish_date: '2020-01-01' })]} />)
    expect(screen.getAllByLabelText(/atrasado/i).length).toBeGreaterThan(0)
  })

  it('wraps the board in a DndContext only when canMove is true', () => {
    const { rerender } = render(<PipelineFlowBoard ideas={[makeIdea()]} canMove={false} />)
    expect(screen.queryByTestId('dnd')).not.toBeInTheDocument()
    rerender(<PipelineFlowBoard ideas={[makeIdea()]} canMove />)
    expect(screen.getByTestId('dnd')).toBeInTheDocument()
  })
})

// ── Opening the detail panel ────────────────────────────────────────────────────

describe('opening the detail panel', () => {
  it('opens the side sheet for the clicked card', () => {
    render(<PipelineFlowBoard ideas={[makeIdea({ id: 'idea-42', title: 'Reel promo' })]} canMove />)
    expect(screen.queryByTestId('sheet')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Reel promo'))
    expect(screen.getByTestId('sheet')).toHaveTextContent('sheet:idea-42')
  })
})

// ── Drag-driven moves ────────────────────────────────────────────────────────────

describe('moving cards via drag', () => {
  it('persists a move to a non-publicada column immediately (optimistic)', async () => {
    render(<PipelineFlowBoard ideas={[makeIdea({ id: 'idea-1', status: 'idea' })]} canMove />)
    act(() => capturedOnDragEnd!({ active: { id: 'idea-1' }, over: { id: 'grabada' } }))
    await waitFor(() => expect(updateIdeaStatus).toHaveBeenCalledWith('idea-1', 'grabada'))
  })

  it('does NOT write to publicada until the confirm dialog is accepted', async () => {
    render(<PipelineFlowBoard ideas={[makeIdea({ id: 'idea-1', status: 'producida' })]} canMove />)
    act(() => capturedOnDragEnd!({ active: { id: 'idea-1' }, over: { id: 'publicada' } }))
    expect(updateIdeaStatus).not.toHaveBeenCalled()
    expect(await screen.findByText(/marcar como publicada/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /sí, publicar/i }))
    await waitFor(() => expect(updateIdeaStatus).toHaveBeenCalledWith('idea-1', 'publicada'))
  })

  it('ignores a drop on the same column', () => {
    render(<PipelineFlowBoard ideas={[makeIdea({ id: 'idea-1', status: 'idea' })]} canMove />)
    act(() => capturedOnDragStart!({ active: { id: 'idea-1' } }))
    act(() => capturedOnDragEnd!({ active: { id: 'idea-1' }, over: { id: 'idea' } }))
    expect(updateIdeaStatus).not.toHaveBeenCalled()
  })
})
