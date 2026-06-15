/**
 * Render/interaction tests for the per-user area-access dialog.
 *
 * Contract:
 *   - Trigger shows "Áreas" (or "Áreas (n)" when restricted; n counts only
 *     still-existing areas).
 *   - "Acceso completo" mode saves null (clears the restriction).
 *   - Restricting pre-fills the checklist with what the user can reach today
 *     (role defaults when unrestricted) so the admin adjusts from there.
 *   - Toggling areas saves the resulting set.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { effectiveAreaHrefs } from '@/lib/auth/areas'

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
    render(<AreaAccessDialog userId="u1" userName="Ana" currentAccess={null} role="editor" />)
    expect(screen.getByRole('button', { name: /^áreas$/i })).toBeInTheDocument()
  })

  it('counts only still-existing areas in the trigger (ignores deleted ones)', () => {
    render(
      <AreaAccessDialog
        userId="u1"
        userName="Ana"
        currentAccess={['/clients', '/team', '/deleted-feature']}
        role="editor"
      />,
    )
    expect(screen.getByRole('button', { name: /áreas \(2\)/i })).toBeInTheDocument()
  })

  it('saves null when keeping full (role-based) access', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(<AreaAccessDialog userId="u1" userName="Ana" currentAccess={['/clients']} role="editor" />)

    await user.click(screen.getByRole('button', { name: /áreas \(1\)/i }))
    await user.click(screen.getByText(/acceso completo/i))
    await user.click(screen.getByRole('button', { name: /^guardar$/i }))

    expect(setUserAreaAccess).toHaveBeenCalledWith('u1', null)
  })

  it("pre-fills the checklist with the user's current role areas when restricting", async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(<AreaAccessDialog userId="u1" userName="Ana" currentAccess={null} role="video" />)

    await user.click(screen.getByRole('button', { name: /^áreas$/i }))
    await user.click(screen.getByText(/restringir a áreas/i))
    await user.click(screen.getByRole('button', { name: /^guardar$/i }))

    const expected = Array.from(effectiveAreaHrefs('video', null))
    const [uid, hrefs] = setUserAreaAccess.mock.calls[0] as unknown as [string, string[]]
    expect(uid).toBe('u1')
    expect([...hrefs].sort()).toEqual([...expected].sort())
  })

  it('adds a toggled area to an existing restricted grant', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(<AreaAccessDialog userId="u1" userName="Ana" currentAccess={['/clients']} role="editor" />)

    await user.click(screen.getByRole('button', { name: /áreas \(1\)/i }))
    await user.click(await screen.findByText('Equipo')) // add /team
    await user.click(screen.getByRole('button', { name: /^guardar$/i }))

    const [, hrefs] = setUserAreaAccess.mock.calls[0] as unknown as [string, string[]]
    expect(hrefs).toContain('/clients')
    expect(hrefs).toContain('/team')
  })
})
