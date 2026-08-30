import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('@/components/auth/login-form', () => ({ LoginForm: () => <div data-testid="form" /> }))

import LoginPage from './page'

afterEach(cleanup)

describe('LoginPage — oauth_error', () => {
  it('muestra el error de Google que trae el callback', () => {
    render(<LoginPage searchParams={{ oauth_error: 'provider is not enabled' }} />)
    expect(screen.getByText(/no se pudo entrar con google/i)).toBeInTheDocument()
    expect(screen.getByText(/provider is not enabled/i)).toBeInTheDocument()
    expect(screen.getByTestId('form')).toBeInTheDocument()
  })

  it('sin oauth_error no muestra el banner', () => {
    render(<LoginPage />)
    expect(screen.queryByText(/no se pudo entrar con google/i)).not.toBeInTheDocument()
  })
})
