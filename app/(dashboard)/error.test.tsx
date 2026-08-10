import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DashboardError from './error'

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }))

vi.mock('@sentry/nextjs', () => ({ captureException }))

describe('DashboardError observability', () => {
  beforeEach(() => captureException.mockClear())

  it('reports route errors to Sentry', async () => {
    const error = new Error('falló la página')

    render(<DashboardError error={error} reset={vi.fn()} />)

    await waitFor(() => expect(captureException).toHaveBeenCalledWith(error))
  })
})
