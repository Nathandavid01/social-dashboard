import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
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

function mockStorage() {
  const m = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
      clear: () => m.clear(),
      key: () => null,
      length: 0,
    },
  })
  return m
}

describe('LoginForm — remember email', () => {
  beforeEach(() => mockStorage())

  it('shows the remember-email checkbox', () => {
    render(<LoginForm />)
    expect(screen.getByLabelText(/Recordar mi correo/i)).toBeInTheDocument()
  })

  it('prefills the email from localStorage on mount', () => {
    const m = mockStorage()
    m.set('nm_remember_email', 'ana@x.com')
    render(<LoginForm />)
    expect((screen.getByLabelText('Correo electrónico') as HTMLInputElement).value).toBe('ana@x.com')
  })

  it('saves the email on submit when remember is checked', () => {
    const m = mockStorage()
    render(<LoginForm />)
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'bob@x.com' } })
    fireEvent.submit(screen.getByLabelText('Correo electrónico').closest('form')!)
    expect(m.get('nm_remember_email')).toBe('bob@x.com')
  })

  it('clears the saved email when remember is unchecked', () => {
    const m = mockStorage()
    m.set('nm_remember_email', 'old@x.com')
    render(<LoginForm />)
    fireEvent.click(screen.getByLabelText(/Recordar mi correo/i)) // uncheck
    fireEvent.submit(screen.getByLabelText('Correo electrónico').closest('form')!)
    expect(m.has('nm_remember_email')).toBe(false)
  })
})
