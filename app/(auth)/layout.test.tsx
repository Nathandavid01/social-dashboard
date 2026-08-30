import { describe, expect, it, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import AuthLayout from './layout'

afterEach(cleanup)

describe('AuthLayout — login simple', () => {
  it('muestra el logo y el wordmark de Nate Media con el contenido centrado', () => {
    render(
      <AuthLayout>
        <div data-testid="child">form</div>
      </AuthLayout>
    )
    expect(screen.getByRole('img', { name: /nate media/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /nate\s*media/i })).toBeInTheDocument()
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('ya no muestra el panel de marketing', () => {
    render(
      <AuthLayout>
        <div>form</div>
      </AuthLayout>
    )
    expect(screen.queryByText(/pipeline de contenido/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/el sistema operativo de tu agencia/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })
})
