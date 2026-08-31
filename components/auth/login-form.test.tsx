import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

const signIn = vi.fn(async (_fd: FormData) => ({}) as { error?: string })
vi.mock('@/lib/actions/auth', () => ({ signIn: (fd: FormData) => signIn(fd) }))

const signInWithOAuth = vi.fn(async (_opts: unknown) => ({
  data: {},
  error: null as { message: string } | null,
}))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signInWithOAuth: (opts: unknown) => signInWithOAuth(opts) } }),
}))

import { LoginForm } from './login-form'

afterEach(() => {
  cleanup()
  signIn.mockReset()
  signInWithOAuth.mockReset().mockResolvedValue({ data: {}, error: null })
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

describe('LoginForm — Google', () => {
  it('muestra el botón "Continuar con Google"', () => {
    render(<LoginForm />)
    expect(screen.getByRole('button', { name: /continuar con google/i })).toBeInTheDocument()
  })

  it('llama a signInWithOAuth con el provider google y redirectTo /auth/callback', async () => {
    render(<LoginForm />)
    fireEvent.click(screen.getByRole('button', { name: /continuar con google/i }))
    await vi.waitFor(() => expect(signInWithOAuth).toHaveBeenCalledTimes(1))
    expect(signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'google',
        options: expect.objectContaining({
          redirectTo: expect.stringContaining('/auth/callback'),
        }),
      })
    )
  })

  it('muestra el error si Google no está configurado', async () => {
    signInWithOAuth.mockResolvedValueOnce({
      data: {},
      error: { message: 'Unsupported provider: provider is not enabled' },
    })
    render(<LoginForm />)
    fireEvent.click(screen.getByRole('button', { name: /continuar con google/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/provider is not enabled/i)
  })
})

describe('LoginForm — mantener sesión iniciada', () => {
  beforeEach(() => mockStorage())

  it('muestra el checkbox "Mantener sesión iniciada" marcado por defecto', () => {
    render(<LoginForm />)
    const box = screen.getByLabelText(/Mantener sesión iniciada/i) as HTMLInputElement
    expect(box).toBeInTheDocument()
    expect(box.checked).toBe(true)
  })

  it('manda remember=1 en el FormData cuando está marcado', async () => {
    render(<LoginForm />)
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }))
    await vi.waitFor(() => expect(signIn).toHaveBeenCalledTimes(1))
    const fd = signIn.mock.calls[0][0] as FormData
    expect(fd.get('remember')).toBe('1')
  })

  it('no manda remember cuando está desmarcado', async () => {
    render(<LoginForm />)
    fireEvent.click(screen.getByLabelText(/Mantener sesión iniciada/i)) // uncheck
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }))
    await vi.waitFor(() => expect(signIn).toHaveBeenCalledTimes(1))
    const fd = signIn.mock.calls[0][0] as FormData
    expect(fd.get('remember')).toBeNull()
  })
})

describe('LoginForm — remember email', () => {
  beforeEach(() => mockStorage())

  it('shows the keep-session checkbox (also remembers the email)', () => {
    render(<LoginForm />)
    expect(screen.getByLabelText(/Mantener sesión iniciada/i)).toBeInTheDocument()
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
    fireEvent.click(screen.getByLabelText(/Mantener sesión iniciada/i)) // uncheck
    fireEvent.submit(screen.getByLabelText('Correo electrónico').closest('form')!)
    expect(m.has('nm_remember_email')).toBe(false)
  })
})
