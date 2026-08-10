import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SentryTestClient } from './sentry-test-client'

const { captureException, flush } = vi.hoisted(() => ({
  captureException: vi.fn(),
  flush: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({ captureException, flush }))

describe('SentryTestClient', () => {
  beforeEach(() => {
    captureException.mockClear()
    flush.mockReset().mockResolvedValue(true)
  })

  it('captures and flushes a controlled browser exception', async () => {
    render(<SentryTestClient />)

    fireEvent.click(screen.getByRole('button', { name: 'Enviar error de prueba' }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Evento enviado'))
    expect(captureException).toHaveBeenCalledWith(expect.any(Error), {
      tags: { verification: 'codex-browser-project-init' },
    })
    expect(flush).toHaveBeenCalledWith(5_000)
  })
})
