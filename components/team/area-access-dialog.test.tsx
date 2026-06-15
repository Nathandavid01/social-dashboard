/**
 * Render/interaction tests for the per-user area-access dialog.
 *
 * Contract:
 *   - Trigger shows "Áreas" (or "Áreas (n)" when the user is already restricted).
 *   - "Acceso completo" mode saves null (clears the restriction).
 *   - "Restringir" mode saves the checked area hrefs.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

const setUserAreaAccess = vi.fn(async () => ({ ok: true as const }))
vi.mock('@/lib/actions/users', () => ({
  setUserAreaAccess: (...a: unknown[]) => setUserAreaAccess(...(a as [])),
}))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

import { AreaAccessDialog } from './area-access-dialog'

beforeEach(() => {
  cleanup()
  setUserAreaAccess.mockClear()
})

describe('AreaAccessDialog', () => {
  it('shows a plain "Áreas" trigger when the user is unrestricted', () => {
    render(<AreaAccessDialog userId="u1" userName="Ana" currentAccess={null} />)
    expect(screen.getByRole('button', { name: /^áreas$/i })).toBeInTheDocument()
  })

  it('shows the count when the user is already restricted', () => {
    render(<AreaAccessDialog userId="u1" userName="Ana" currentAccess={['/clients', '/team']} />)
    expect(screen.getByRole('button', { name: /áreas \(2\)/i })).toBeInTheDocument()
  })

  it('saves null when keeping full (role-based) access', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(<AreaAccessDialog userId="u1" userName="Ana" currentAccess={['/clients']} />)

    await user.click(screen.getByRole('button', { name: /áreas \(1\)/i }))
    await user.click(screen.getByText(/acceso completo/i))
    await user.click(screen.getByRole('button', { name: /^guardar$/i }))

    expect(setUserAreaAccess).toHaveBeenCalledWith('u1', null)
  })

  it('saves the checked areas when restricting', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(<AreaAccessDialog userId="u1" userName="Ana" currentAccess={null} />)

    await user.click(screen.getByRole('button', { name: /^áreas$/i }))
    await user.click(screen.getByText(/restringir a áreas/i))
    // The area checklist appears; pick "Clientes".
    await user.click(await screen.findByText('Clientes'))
    await user.click(screen.getByRole('button', { name: /^guardar$/i }))

    expect(setUserAreaAccess).toHaveBeenCalledTimes(1)
    const [uid, hrefs] = setUserAreaAccess.mock.calls[0] as unknown as [string, string[]]
    expect(uid).toBe('u1')
    expect(hrefs).toContain('/clients')
  })
})
