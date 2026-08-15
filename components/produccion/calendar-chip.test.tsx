import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CalendarChip } from './calendar-chip'
import type { ProductionTask } from '@/lib/supabase/types'

function makeTask(overrides: Partial<ProductionTask> = {}): ProductionTask {
  return {
    id: 't1',
    client_id: 'c1',
    schedule_id: null,
    content_type: 'R',
    publish_date: '2026-08-18',
    deadline: null,
    assigned_to_id: null,
    status: 'aprobado',
    notes: null,
    review_notes: null,
    is_special_request: false,
    priority: 'media',
    week_start: null,
    idea_id: null,
    created_by: null,
    created_at: '',
    updated_at: '',
    idea: null,
    ...overrides,
  }
}

describe('CalendarChip', () => {
  it('shows Reel / Post label based on content type', () => {
    render(<CalendarChip contentType="R" task={undefined} />)
    expect(screen.getByText('Reel')).toBeInTheDocument()

    render(<CalendarChip contentType="P" task={undefined} />)
    expect(screen.getByText('Post')).toBeInTheDocument()
  })

  it('renders the status badge when a task exists', () => {
    render(<CalendarChip contentType="R" task={makeTask({ status: 'en_edicion' })} />)
    expect(screen.getByText('En Edición')).toBeInTheDocument()
  })

  it('renders no status badge when there is no task (pendiente slot, nothing generated yet)', () => {
    render(<CalendarChip contentType="R" task={undefined} />)
    expect(screen.queryByTestId('calendar-chip-check')).not.toBeInTheDocument()
  })

  it('shows a green check + ring when the task status is publicado', () => {
    render(<CalendarChip contentType="R" task={makeTask({ status: 'publicado' })} />)
    expect(screen.getByTestId('calendar-chip-check')).toBeInTheDocument()
  })

  it('shows the check when the linked idea is publicada even if the task status lags', () => {
    render(
      <CalendarChip
        contentType="P"
        task={makeTask({ status: 'aprobado', idea: { status: 'publicada', published_at: null } })}
      />
    )
    expect(screen.getByTestId('calendar-chip-check')).toBeInTheDocument()
  })

  it('shows the check when published_at is filled', () => {
    render(
      <CalendarChip
        contentType="P"
        task={makeTask({ status: 'aprobado', idea: { status: 'producida', published_at: '2026-08-18T10:00:00Z' } })}
      />
    )
    expect(screen.getByTestId('calendar-chip-check')).toBeInTheDocument()
  })

  it('does NOT show the check for a merely pending/in-progress task', () => {
    render(<CalendarChip contentType="R" task={makeTask({ status: 'en_revision' })} />)
    expect(screen.queryByTestId('calendar-chip-check')).not.toBeInTheDocument()
  })
})
