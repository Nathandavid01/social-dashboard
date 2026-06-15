/**
 * Render/interaction tests for the self-service change-password form.
 * The server action is mocked; we assert the form wires inputs through and
 * surfaces server errors.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

const updatePassword = vi.fn(async () => ({ ok: true as const }))
vi.mock('@/lib/actions/auth', () => ({
  updatePassword: (...a: unknown[]) => updatePassword(...(a as [])),
}))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

import { ChangePasswordForm } from './change-password-form'

beforeEach(() => {
  cleanup()
  updatePassword.mockClear()
})

describe('ChangePasswordForm', () => {
  it('submits the three fields to updatePassword', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(<ChangePasswordForm />)

    await user.type(screen.getByLabelText('Contraseña actual'), 'oldpass123')
    await user.type(screen.getByLabelText('Nueva contraseña'), 'newpass456')
    await user.type(screen.getByLabelText('Confirmar nueva contraseña'), 'newpass456')
    await user.click(screen.getByRole('button', { name: /actualizar contraseña/i }))

    expect(updatePassword).toHaveBeenCalledWith({
      current: 'oldpass123',
      next: 'newpass456',
      confirm: 'newpass456',
    })
  })

  it('shows the server error when the change is rejected', async () => {
    updatePassword.mockResolvedValueOnce({ error: 'La contraseña actual es incorrecta.' } as never)
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(<ChangePasswordForm />)

    await user.type(screen.getByLabelText('Contraseña actual'), 'wrong')
    await user.type(screen.getByLabelText('Nueva contraseña'), 'newpass456')
    await user.type(screen.getByLabelText('Confirmar nueva contraseña'), 'newpass456')
    await user.click(screen.getByRole('button', { name: /actualizar contraseña/i }))

    expect(await screen.findByText(/contraseña actual es incorrecta/i)).toBeInTheDocument()
  })
})
