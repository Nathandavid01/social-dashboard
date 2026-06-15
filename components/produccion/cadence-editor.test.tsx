/**
 * CadenceEditor: per-client day × R/P editor. Toggling cycles empty→R→P→empty
 * and Guardar saves the resulting schedule rows. Gated by production.edit.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

const upsert = vi.fn(async () => ({ error: null }))
vi.mock('@/lib/actions/production', () => ({
  upsertProductionSchedules: (...a: unknown[]) => upsert(...(a as [])),
}))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

let mockRole = 'owner'
vi.mock('@/lib/context/auth-context', () => ({ useAuth: () => ({ role: mockRole }) }))

import { CadenceEditor } from './cadence-editor'

beforeEach(() => {
  cleanup()
  upsert.mockClear()
  mockRole = 'owner'
})

describe('CadenceEditor', () => {
  it('renders the current cadence (R on Mon, P on Tue)', () => {
    render(<CadenceEditor clientId="c1" initialSchedules={[{ day_of_week: 1, content_type: 'R' }, { day_of_week: 2, content_type: 'P' }]} />)
    expect(screen.getByTestId('day-1')).toHaveTextContent('R')
    expect(screen.getByTestId('day-2')).toHaveTextContent('P')
  })

  it('cycles a day empty→R→P→empty on click and saves the result', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(<CadenceEditor clientId="c1" initialSchedules={[]} />)

    await user.click(screen.getByTestId('day-3')) // empty -> R
    expect(screen.getByTestId('day-3')).toHaveTextContent('R')
    await user.click(screen.getByTestId('day-5')) // empty -> R
    await user.click(screen.getByTestId('day-5')) // R -> P

    await user.click(screen.getByRole('button', { name: /guardar/i }))
    expect(upsert).toHaveBeenCalledWith('c1', [
      { day_of_week: 3, content_type: 'R' },
      { day_of_week: 5, content_type: 'P' },
    ], [])
  })

  it('passes the original days so removing a day fully replaces (delete+insert)', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(<CadenceEditor clientId="c1" initialSchedules={[{ day_of_week: 1, content_type: 'R' }]} />)

    await user.click(screen.getByTestId('day-1')) // R -> P
    await user.click(screen.getByTestId('day-1')) // P -> empty (removed)
    await user.click(screen.getByRole('button', { name: /guardar/i }))
    expect(upsert).toHaveBeenCalledWith('c1', [], [1])
  })

  it('is read-only for a role without production.edit (no save button)', () => {
    mockRole = null as unknown as string
    render(<CadenceEditor clientId="c1" initialSchedules={[{ day_of_week: 1, content_type: 'R' }]} />)
    expect(screen.queryByRole('button', { name: /guardar/i })).not.toBeInTheDocument()
  })
})
