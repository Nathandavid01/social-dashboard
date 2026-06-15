/**
 * MasterScheduleView (now data-driven): renders the live per-client weekly
 * cadence from production_schedules as a clean clients × days grid with R/P
 * pills and a weekly total per client.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { MasterScheduleView } from './master-schedule-view'
import type { ProductionSchedule } from '@/lib/supabase/types'

function sched(clientId: string, name: string, day: number, type: 'R' | 'P'): ProductionSchedule {
  return {
    id: `${clientId}-${day}-${type}`,
    client_id: clientId,
    day_of_week: day,
    content_type: type,
    assigned_editor_id: null,
    assigned_designer_id: null,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    client: { id: clientId, name, industry: null },
  }
}

// Casita Vieja: Lun-R, Mar-P, Mié-R (3 total) · Tierra Nueva: Jue-R (1 total)
const schedules: ProductionSchedule[] = [
  sched('c1', 'Casita Vieja', 1, 'R'),
  sched('c1', 'Casita Vieja', 2, 'P'),
  sched('c1', 'Casita Vieja', 3, 'R'),
  sched('c2', 'Tierra Nueva', 4, 'R'),
]

beforeEach(() => cleanup())

describe('MasterScheduleView (live cadence)', () => {
  it('renders a row per client with its name', () => {
    render(<MasterScheduleView schedules={schedules} />)
    expect(screen.getByText('Casita Vieja')).toBeInTheDocument()
    expect(screen.getByText('Tierra Nueva')).toBeInTheDocument()
  })

  it('shows the weekly total of pieces per client', () => {
    render(<MasterScheduleView schedules={schedules} />)
    const row = screen.getByText('Casita Vieja').closest('[data-row]') as HTMLElement
    expect(within(row).getByTestId('total')).toHaveTextContent('3')
    const row2 = screen.getByText('Tierra Nueva').closest('[data-row]') as HTMLElement
    expect(within(row2).getByTestId('total')).toHaveTextContent('1')
  })

  it("places R/P pills on the right days", () => {
    render(<MasterScheduleView schedules={schedules} />)
    const row = screen.getByText('Casita Vieja').closest('[data-row]') as HTMLElement
    const cells = within(row).getAllByTestId(/^cell-/)
    // 7 day cells
    expect(cells).toHaveLength(7)
    expect(cells[0]).toHaveTextContent('R') // Lun
    expect(cells[1]).toHaveTextContent('P') // Mar
    expect(cells[2]).toHaveTextContent('R') // Mié
    expect(cells[3]).toHaveTextContent('') // Jue empty
  })

  it('renders an empty state when there are no schedules', () => {
    render(<MasterScheduleView schedules={[]} />)
    expect(screen.getByText(/sin cadencia/i)).toBeInTheDocument()
  })

  it('summarizes total clients and weekly R/P counts', () => {
    render(<MasterScheduleView schedules={schedules} />)
    expect(screen.getByText('2')).toBeInTheDocument() // 2 clientes (also appears, but at least present)
    // 3 reels (Casita 2 + Tierra 1), 1 post
    expect(screen.getByTestId('summary')).toHaveTextContent('3')
    expect(screen.getByTestId('summary')).toHaveTextContent('1')
  })
})
