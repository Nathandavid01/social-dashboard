import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

const resetUserPassword = vi.fn<(...a: unknown[]) => Promise<{ ok?: true; error?: string }>>(async () => ({ ok: true }))
vi.mock('@/lib/actions/users', () => ({ resetUserPassword: (...a: unknown[]) => resetUserPassword(...a) }))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

import { ResetPasswordDialog } from './reset-password-dialog'

beforeEach(() => {
  cleanup()
  resetUserPassword.mockClear()
})

describe('ResetPasswordDialog', () => {
  it('renders the launcher button', () => {
    render(<ResetPasswordDialog userId="u1" userName="Ana" />)
    expect(screen.getByRole('button', { name: 'Contraseña' })).toBeInTheDocument()
  })

  it('opens with a prefilled temp password and resets it for the user', async () => {
    render(<ResetPasswordDialog userId="u1" userName="Ana" />)
    fireEvent.click(screen.getByRole('button', { name: 'Contraseña' }))

    const input = document.querySelector('input') as HTMLInputElement
    expect(input.value.length).toBeGreaterThanOrEqual(8)

    fireEvent.click(screen.getByRole('button', { name: /resetear contraseña/i }))
    await waitFor(() => expect(resetUserPassword).toHaveBeenCalledTimes(1))
    expect(resetUserPassword.mock.calls[0][0]).toBe('u1')
    expect(String(resetUserPassword.mock.calls[0][1]).length).toBeGreaterThanOrEqual(8)
  })

  it('disables reset when the password is too short', () => {
    render(<ResetPasswordDialog userId="u1" userName="Ana" />)
    fireEvent.click(screen.getByRole('button', { name: 'Contraseña' }))
    const input = document.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'short' } })
    expect(screen.getByRole('button', { name: /resetear contraseña/i })).toBeDisabled()
  })
})
