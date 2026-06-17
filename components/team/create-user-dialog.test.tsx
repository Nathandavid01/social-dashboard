import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

const createTeamUser = vi.fn<(...a: unknown[]) => Promise<{ ok?: true; userId?: string; error?: string }>>(async () => ({ ok: true, userId: 'u-new' }))
vi.mock('@/lib/actions/users', () => ({ createTeamUser: (...a: unknown[]) => createTeamUser(...a) }))
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

import { CreateUserDialog } from './create-user-dialog'

beforeEach(() => {
  cleanup()
  createTeamUser.mockClear()
  refresh.mockClear()
})

describe('CreateUserDialog', () => {
  it('renders the launcher button', () => {
    render(<CreateUserDialog />)
    expect(screen.getByRole('button', { name: /crear usuario/i })).toBeInTheDocument()
  })

  it('opens the form with email, name, role and a temp password', () => {
    render(<CreateUserDialog />)
    fireEvent.click(screen.getByRole('button', { name: /crear usuario/i }))
    expect(screen.getByPlaceholderText(/nombre@nmedia\.pr/i)).toBeInTheDocument()
    expect(screen.getByText('Rol (permisos)')).toBeInTheDocument()
    expect(screen.getByText('Contraseña temporal')).toBeInTheDocument()
  })

  it('cannot submit until email and name are filled, then creates the user', async () => {
    render(<CreateUserDialog />)
    fireEvent.click(screen.getByRole('button', { name: /crear usuario/i }))

    // The submit button is the second "Crear usuario" (after the trigger).
    const submit = () => screen.getAllByRole('button', { name: /crear usuario/i }).at(-1)!
    expect(submit()).toBeDisabled()

    fireEvent.change(screen.getByPlaceholderText(/nombre@nmedia\.pr/i), { target: { value: 'nuevo@nmedia.pr' } })
    fireEvent.change(screen.getByPlaceholderText(/maría rodríguez/i), { target: { value: 'Nuevo Editor' } })
    expect(submit()).not.toBeDisabled()

    fireEvent.click(submit())
    await waitFor(() => expect(createTeamUser).toHaveBeenCalledTimes(1))
    const arg = createTeamUser.mock.calls[0][0] as unknown as { email: string; fullName: string; role: string; password: string }
    expect(arg.email).toBe('nuevo@nmedia.pr')
    expect(arg.fullName).toBe('Nuevo Editor')
    expect(arg.role).toBe('editor') // default assignable role
    expect(arg.password.length).toBeGreaterThanOrEqual(8)
  })
})
