import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { ClientIdeasRows } from './client-ideas-rows'
import type { IdeaWithPipeline } from '@/lib/supabase/types'

vi.mock('@/components/clients/client-logo', () => ({ ClientLogo: () => <div data-testid="logo" /> }))

// Inline date editing calls this server action; bulk selection uses toast on error.
const updateIdeaDates = vi.fn(async () => ({ success: true as const }))
vi.mock('@/lib/actions/content-ideas', () => ({
  updateIdeaDates: (...a: unknown[]) => updateIdeaDates(...(a as [])),
}))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

beforeEach(() => {
  cleanup()
  updateIdeaDates.mockClear()
})

function idea(over: Partial<IdeaWithPipeline> = {}): IdeaWithPipeline {
  return {
    id: 'i1', client_id: 'c1', content_type: 'R', title: 'Reel 1', hook: 'h', visual_brief: 'b',
    caption_angle: null, hashtags_suggestion: null, rationale: null, status: 'idea',
    production_task_id: null, recording_session_id: null, theme: null, generation_prompt: null,
    model: null, generated_caption: null, caption_platform: null, caption_generated_at: null,
    published_at: null, approval_status: 'pending', approved_by: null, approved_at: null,
    submitted_at: null, recording_date: '2026-05-10', publish_date: '2026-05-15',
    created_by: null, created_at: '', updated_at: '',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: { id: 'c1', name: 'Acme', industry: null, logo_url: null, platforms: [] } as any,
    recordingScheduled: false, videos: [],
    ...over,
  } as IdeaWithPipeline
}

describe('ClientIdeasRows', () => {
  it('groups ideas by client and renders a row per video', () => {
    render(<ClientIdeasRows ideas={[idea(), idea({ id: 'i2', title: 'Reel 2' })]} />)
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.getByText('Reel 1')).toBeInTheDocument()
    expect(screen.getByText('Reel 2')).toBeInTheDocument()
    expect(screen.getByText('2 videos')).toBeInTheDocument()
  })

  it('shows both dates per video', () => {
    render(<ClientIdeasRows ideas={[idea()]} />)
    expect(screen.getByText(/10/)).toBeInTheDocument() // recording day
    expect(screen.getByText(/15/)).toBeInTheDocument() // publish day
  })

  it('separates ideas from different clients into their own sections', () => {
    render(
      <ClientIdeasRows
        ideas={[
          idea(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          idea({ id: 'i9', client_id: 'c2', title: 'Otro', client: { id: 'c2', name: 'Beta', industry: null, logo_url: null, platforms: [] } as any }),
        ]}
      />,
    )
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })
})

describe('IdeaRow inline date editing', () => {
  it('opens date inputs on pencil click and saves via updateIdeaDates + onDatesSaved', async () => {
    const onDatesSaved = vi.fn()
    render(<ClientIdeasRows ideas={[idea({ recording_date: null, publish_date: null })]} onDatesSaved={onDatesSaved} />)

    expect(screen.queryByLabelText('Fecha de publicación')).toBeNull()
    fireEvent.click(screen.getByLabelText('Editar fechas'))

    fireEvent.change(screen.getByLabelText('Fecha de grabación'), { target: { value: '2026-06-01' } })
    fireEvent.change(screen.getByLabelText('Fecha de publicación'), { target: { value: '2026-06-05' } })
    fireEvent.click(screen.getByLabelText('Guardar fechas'))

    await waitFor(() => expect(updateIdeaDates).toHaveBeenCalledTimes(1))
    expect(updateIdeaDates).toHaveBeenCalledWith('i1', { recording_date: '2026-06-01', publish_date: '2026-06-05' })
    await waitFor(() =>
      expect(onDatesSaved).toHaveBeenCalledWith('i1', { recording_date: '2026-06-01', publish_date: '2026-06-05' }),
    )
  })

  it('clears a date to null when the input is emptied', async () => {
    render(<ClientIdeasRows ideas={[idea({ recording_date: null })]} />)
    fireEvent.click(screen.getByLabelText('Editar fechas'))
    fireEvent.change(screen.getByLabelText('Fecha de publicación'), { target: { value: '' } })
    fireEvent.click(screen.getByLabelText('Guardar fechas'))
    await waitFor(() => expect(updateIdeaDates).toHaveBeenCalledTimes(1))
    expect(updateIdeaDates).toHaveBeenCalledWith('i1', { recording_date: null, publish_date: null })
  })
})

describe('IdeaRow bulk selection', () => {
  it('renders a checkbox only on assignable (status === idea) rows when selectable', () => {
    render(
      <ClientIdeasRows
        ideas={[
          idea({ id: 'a', title: 'Asignable', status: 'idea' }),
          idea({ id: 'b', title: 'Ya asignada', status: 'asignada' }),
        ]}
        selectable
        selectedIds={new Set()}
        onToggleSelect={vi.fn()}
        onToggleGroup={vi.fn()}
      />,
    )
    expect(screen.queryByLabelText('Seleccionar Asignable')).not.toBeNull()
    expect(screen.queryByLabelText('Seleccionar Ya asignada')).toBeNull()
  })

  it('does not render row checkboxes when selectable is false', () => {
    render(<ClientIdeasRows ideas={[idea({ title: 'Asignable' })]} />)
    expect(screen.queryByLabelText('Seleccionar Asignable')).toBeNull()
  })

  it('fires onToggleSelect with the idea id when its checkbox is clicked', () => {
    const onToggleSelect = vi.fn()
    render(
      <ClientIdeasRows
        ideas={[idea({ id: 'a', title: 'Asignable', status: 'idea' })]}
        selectable
        selectedIds={new Set()}
        onToggleSelect={onToggleSelect}
        onToggleGroup={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByLabelText('Seleccionar Asignable'))
    expect(onToggleSelect).toHaveBeenCalledWith('a')
  })
})

describe('IdeaRow next action', () => {
  it('shows the next action badge when showNextAction is set', () => {
    render(<ClientIdeasRows ideas={[idea({ status: 'idea' })]} showNextAction />)
    // hook+brief filled, no caption → next action is "Generar el caption"
    expect(screen.getByText(/Generar el caption/)).toBeInTheDocument()
  })

  it('hides the next action badge by default', () => {
    render(<ClientIdeasRows ideas={[idea({ status: 'idea' })]} />)
    expect(screen.queryByText(/Generar el caption/)).toBeNull()
  })
})

describe('IdeaRow assignee', () => {
  it('shows the assigned person on an assigned idea', () => {
    render(
      <ClientIdeasRows
        ideas={[
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          idea({ id: 'x', title: 'Asignada', status: 'asignada', assignee: { id: 'p1', full_name: 'María Vega' } } as any),
        ]}
        onAssign={vi.fn()}
      />,
    )
    expect(screen.getByText('María Vega')).toBeInTheDocument()
    expect(screen.getByText('MV')).toBeInTheDocument() // avatar initials fallback
  })

  it('shows Asignar (not an assignee) on an unassigned idea', () => {
    render(<ClientIdeasRows ideas={[idea({ id: 'y', title: 'Pendiente', status: 'idea' })]} onAssign={vi.fn()} />)
    expect(screen.getByText(/Asignar/)).toBeInTheDocument()
  })
})

describe('IdeaRow assign button', () => {
  it('hides Asignar when canAssign is false (no permission)', () => {
    render(<ClientIdeasRows ideas={[idea({ id: 'a', title: 'Pendiente', status: 'idea' })]} onAssign={vi.fn()} canAssign={false} />)
    expect(screen.queryByText(/Asignar/)).toBeNull()
  })

  it('shows Asignar only for assignable rows', () => {
    render(
      <ClientIdeasRows
        ideas={[
          idea({ id: 'a', title: 'Asignable', status: 'idea' }),
          idea({ id: 'b', title: 'Asignada', status: 'asignada' }),
        ]}
        onAssign={vi.fn()}
      />,
    )
    const assignButtons = screen.getAllByRole('button').filter((b) => /asignar/i.test(b.textContent ?? ''))
    expect(assignButtons).toHaveLength(1)
  })
})
