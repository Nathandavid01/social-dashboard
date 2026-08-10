import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

const getSession = vi.fn(async () => ({ data: { session: { user: { id: 'u1' } } }, error: null }))
const setSession = vi.fn(async () => ({ data: { session: { user: { id: 'u1' } } }, error: null }))
const updateUser = vi.fn(async () => ({ data: { user: null }, error: null }))
const signOut = vi.fn(async () => ({ error: null }))
const replace = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getSession, setSession, updateUser, signOut } }),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }))

import { RecoveryPasswordForm } from './recovery-password-form'

beforeEach(() => {
  cleanup()
  getSession.mockClear()
  setSession.mockClear()
  updateUser.mockClear()
  signOut.mockClear()
  replace.mockClear()
})

describe('RecoveryPasswordForm', () => {
  it('sets a new password from a recovery session without asking for the old one', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(<RecoveryPasswordForm />)

    await user.type(await screen.findByLabelText('Nueva contraseña'), 'newpass456')
    await user.type(screen.getByLabelText('Confirmar nueva contraseña'), 'newpass456')
    await user.click(screen.getByRole('button', { name: /guardar contraseña/i }))

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: 'newpass456' }))
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith('/login?reset=1')
  })

  it('explains when the recovery link no longer has a valid session', async () => {
    getSession.mockResolvedValueOnce({ data: { session: null }, error: null } as never)
    render(<RecoveryPasswordForm />)

    expect(await screen.findByText(/enlace de recuperación expiró/i)).toBeInTheDocument()
  })
})
