import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

const signIn = vi.fn(async (_fd: FormData) => ({}) as { error?: string })
vi.mock('@/lib/actions/auth', () => ({ signIn: (fd: FormData) => signIn(fd) }))

import { LoginForm } from './login-form'

afterEach(() => {
  cleanup()
  signIn.mockReset()
})

describe('LoginForm', () => {
  it('renders the Spanish heading, fields and submit', () => {
    render(<LoginForm />)
    expect(screen.getByRole('heading', { name: /bienvenido de nuevo/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument()
  })

  it('toggles password visibility', () => {
    render(<LoginForm />)
    const pw = screen.getByLabelText('Contraseña') as HTMLInputElement
    expect(pw.type).toBe('password')
    fireEvent.click(screen.getByRole('button', { name: /mostrar contraseña/i }))
    expect(pw.type).toBe('text')
    fireEvent.click(screen.getByRole('button', { name: /ocultar contraseña/i }))
    expect(pw.type).toBe('password')
  })

  it('surfaces the error returned by signIn', async () => {
    signIn.mockResolvedValueOnce({ error: 'Credenciales inválidas' })
    render(<LoginForm />)
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales inválidas')
  })
})
