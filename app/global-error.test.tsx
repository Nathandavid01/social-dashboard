import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

/**
 * El error boundary de la raíz.
 *
 * Es el único sitio que captura un fallo del root layout o del render de React:
 * si no reporta, esos errores no existen para Sentry. Y lo que ve el usuario
 * importa igual — una pantalla en blanco es un bug, no un error boundary.
 */

const captureException = vi.fn()
vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => captureException(...args),
}))

beforeEach(() => {
  captureException.mockClear()
})

describe('GlobalError', () => {
  it('reporta a Sentry el error que recibe', async () => {
    const { default: GlobalError } = await import('./global-error')
    const error = Object.assign(new Error('se cayó el layout'), { digest: 'abc123' })

    render(<GlobalError error={error} reset={() => {}} />)

    expect(captureException).toHaveBeenCalledTimes(1)
    expect(captureException).toHaveBeenCalledWith(error)
  })

  it('le enseña al usuario algo en español, no una pantalla en blanco', async () => {
    const { default: GlobalError } = await import('./global-error')

    render(<GlobalError error={new Error('boom')} reset={() => {}} />)

    expect(screen.getByText(/algo se rompió/i)).toBeInTheDocument()
  })

  it('ofrece reintentar, y reintentar llama a reset', async () => {
    const { default: GlobalError } = await import('./global-error')
    const reset = vi.fn()

    render(<GlobalError error={new Error('boom')} reset={reset} />)
    screen.getByRole('button', { name: /reintentar/i }).click()

    expect(reset).toHaveBeenCalledTimes(1)
  })
})
