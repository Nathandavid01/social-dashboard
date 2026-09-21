import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

const resetUserPassword = vi.fn<(...a: unknown[]) => Promise<{ ok?: true; error?: string }>>(
  async () => ({ ok: true }),
)
const toast = vi.fn()
vi.mock('@/lib/actions/users', () => ({ resetUserPassword: (...a: unknown[]) => resetUserPassword(...a) }))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))

import { ResetPasswordDialog } from './reset-password-dialog'

beforeEach(() => {
  cleanup()
  resetUserPassword.mockReset().mockResolvedValue({ ok: true })
  toast.mockClear()
})

function open() {
  render(<ResetPasswordDialog userId="u1" userName="Ana" userEmail="ana@x.com" />)
  fireEvent.click(screen.getByRole('button', { name: 'Nueva contraseña de Ana' }))
}

describe('ResetPasswordDialog', () => {
  it('offers a named action for that person', () => {
    render(<ResetPasswordDialog userId="u1" userName="Ana" userEmail="ana@x.com" />)
    expect(screen.getByRole('button', { name: 'Nueva contraseña de Ana' })).toBeInTheDocument()
  })

  it('opens with a generated password and names who will receive it', () => {
    open()
    expect(screen.getByRole('heading', { name: 'Asignar contraseña' })).toBeInTheDocument()
    expect(screen.getByText(/ana@x.com/)).toBeInTheDocument()
    const input = screen.getByLabelText('Nueva contraseña') as HTMLInputElement
    expect(input.value.length).toBeGreaterThanOrEqual(8)
  })

  it('assigns that password and keeps it on screen so it can be copied', async () => {
    open()
    const input = screen.getByLabelText('Nueva contraseña') as HTMLInputElement
    const value = input.value

    fireEvent.click(screen.getByRole('button', { name: 'Asignar contraseña' }))

    await waitFor(() => expect(resetUserPassword).toHaveBeenCalledTimes(1))
    expect(resetUserPassword.mock.calls[0]).toEqual(['u1', value])
    expect(screen.getByLabelText('Nueva contraseña')).toHaveValue(value)
    expect(screen.getByText(/la anterior ya no sirve para entrar/i)).toBeInTheDocument()
    expect(screen.getByText(/sigue visible para copiarla/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copiar contraseña' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Generar otra' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ocultar contraseña' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Listo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Asignar contraseña' })).not.toBeInTheDocument()
  })

  it('stays open and shows the error when the assignment fails', async () => {
    resetUserPassword.mockResolvedValue({ error: 'Solo un Owner puede asignar la contraseña de un Owner o Supervisor.' })
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Asignar contraseña' }))
    await waitFor(() => expect(toast).toHaveBeenCalled())
    expect(toast.mock.calls[0][0].variant).toBe('destructive')
    expect(screen.getByRole('heading', { name: 'Asignar contraseña' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Listo' })).not.toBeInTheDocument()
  })

  it('disables assign when the password is too short', () => {
    open()
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'short' } })
    expect(screen.getByRole('button', { name: 'Asignar contraseña' })).toBeDisabled()
  })

  it('can hide the password before sharing it', () => {
    open()
    const input = screen.getByLabelText('Nueva contraseña') as HTMLInputElement
    expect(input.type).toBe('text')
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }))
    expect(input.type).toBe('password')
  })
})
