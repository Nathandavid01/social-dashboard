/**
 * Render/interaction tests for the owner-facing pending-approvals table.
 *
 * Contract:
 *   - Empty state when there are no pending accounts.
 *   - One row per pending account showing name + email.
 *   - "Aprobar" opens a role-picker dialog and only calls approveUser after a
 *     role is confirmed (defaulting to editor); "Rechazar" calls rejectUser.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { Profile } from '@/lib/supabase/types'

const approveUser = vi.fn(async () => ({ ok: true as const }))
const rejectUser = vi.fn(async () => ({ ok: true as const }))
vi.mock('@/lib/actions/approvals', () => ({
  approveUser: (...a: unknown[]) => approveUser(...(a as [])),
  rejectUser: (...a: unknown[]) => rejectUser(...(a as [])),
}))

vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

import { PendingApprovals } from './pending-approvals'

function makeProfile(over: Partial<Profile> = {}): Profile {
  return {
    id: 'u1',
    email: 'nuevo@nmedia.pr',
    full_name: 'Nuevo Usuario',
    avatar_url: null,
    role: 'team_member',
    status: 'active',
    approval_status: 'pending',
    title: null,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    ...over,
  }
}

beforeEach(() => {
  cleanup()
  approveUser.mockClear()
  rejectUser.mockClear()
})

describe('PendingApprovals', () => {
  it('shows an empty state when there are no pending accounts', () => {
    render(<PendingApprovals pending={[]} />)
    expect(screen.getByText(/no hay cuentas pendientes/i)).toBeInTheDocument()
  })

  it('renders a row per pending account with name and email', () => {
    render(
      <PendingApprovals
        pending={[
          makeProfile({ id: 'a', full_name: 'Ana Díaz', email: 'ana@nmedia.pr' }),
          makeProfile({ id: 'b', full_name: 'Beto Cruz', email: 'beto@nmedia.pr' }),
        ]}
      />,
    )
    expect(screen.getByText('Ana Díaz')).toBeInTheDocument()
    expect(screen.getByText('ana@nmedia.pr')).toBeInTheDocument()
    expect(screen.getByText('Beto Cruz')).toBeInTheDocument()
    expect(screen.getByText(/2 pendientes/i)).toBeInTheDocument()
  })

  it('approve flow opens the role dialog and only fires after confirming', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(<PendingApprovals pending={[makeProfile({ id: 'a', full_name: 'Ana Díaz' })]} />)

    await user.click(screen.getByRole('button', { name: /^aprobar$/i }))
    // Dialog open — server action not called yet.
    expect(approveUser).not.toHaveBeenCalled()

    const confirm = await screen.findByRole('button', { name: /aprobar como/i })
    await user.click(confirm)
    // Default role is editor.
    expect(approveUser).toHaveBeenCalledWith('a', 'editor')
  })

  it('reject calls rejectUser with the user id', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(<PendingApprovals pending={[makeProfile({ id: 'a' })]} />)
    await user.click(screen.getByRole('button', { name: /rechazar/i }))
    expect(rejectUser).toHaveBeenCalledWith('a')
  })
})
