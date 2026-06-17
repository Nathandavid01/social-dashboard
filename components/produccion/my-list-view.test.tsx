import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { ProductionTask } from '@/lib/supabase/types'

vi.mock('@/lib/actions/production', () => ({ updateTaskStatus: vi.fn(async () => ({ success: true })) }))
vi.mock('./status-badge', () => ({ StatusBadge: () => <span>estado</span> }))

import { MyListView } from './my-list-view'

// A past publish_date lands the task in the "Hoy" group so it always renders.
const task = (over: Partial<ProductionTask> = {}): ProductionTask => ({
  id: 't1', client_id: 'c1', content_type: 'R', status: 'pendiente',
  publish_date: '2026-06-01', deadline: null, assigned_to_id: 'u1',
  client: { id: 'c1', name: 'Nora' },
  ...over,
} as ProductionTask)

afterEach(() => cleanup())

describe('MyListView — deadline badge', () => {
  it('shows "Atrasado" for a past deadline on an active task', () => {
    render(<MyListView tasks={[task({ id: 'a', deadline: '2020-01-01' })]} />)
    expect(screen.getByText('Atrasado')).toBeInTheDocument()
  })

  it('suppresses the deadline badge once the task is aprobado', () => {
    render(<MyListView tasks={[task({ id: 'b', status: 'aprobado', deadline: '2020-01-01' })]} />)
    expect(screen.queryByText('Atrasado')).toBeNull()
  })

  it('shows no deadline badge when there is no deadline', () => {
    render(<MyListView tasks={[task({ id: 'c', deadline: null })]} />)
    expect(screen.queryByText('Atrasado')).toBeNull()
    expect(screen.queryByText('Pronto')).toBeNull()
  })
})
