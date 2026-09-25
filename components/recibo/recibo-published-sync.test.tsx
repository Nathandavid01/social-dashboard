import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'

const syncReciboPublished = vi.fn()
const refresh = vi.fn()
const toast = vi.fn()

vi.mock('@/lib/actions/recibo', () => ({ syncReciboPublished: () => syncReciboPublished() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))

import { ReciboPublishedSync } from './recibo-published-sync'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ReciboPublishedSync', () => {
  it('al abrir Recibo, si había videos ya en Metricool, avisa y recarga sin ellos', async () => {
    syncReciboPublished.mockResolvedValue({ linked: 2 })
    render(<ReciboPublishedSync />)
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    expect(toast).toHaveBeenCalledWith({ title: '2 videos ya estaban en Metricool y salieron de Recibo' })
  })

  it('uno solo, en singular', async () => {
    syncReciboPublished.mockResolvedValue({ linked: 1 })
    render(<ReciboPublishedSync />)
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: '1 video ya estaba en Metricool y salió de Recibo' }))
  })

  it('si no había nada, no recarga ni avisa', async () => {
    syncReciboPublished.mockResolvedValue({ linked: 0 })
    render(<ReciboPublishedSync />)
    await waitFor(() => expect(syncReciboPublished).toHaveBeenCalledTimes(1))
    expect(refresh).not.toHaveBeenCalled()
    expect(toast).not.toHaveBeenCalled()
  })

  it('si Metricool falla, Recibo sigue igual y en silencio', async () => {
    syncReciboPublished.mockRejectedValue(new Error('network'))
    render(<ReciboPublishedSync />)
    await waitFor(() => expect(syncReciboPublished).toHaveBeenCalledTimes(1))
    expect(refresh).not.toHaveBeenCalled()
    expect(toast).not.toHaveBeenCalled()
  })
})
