import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'

const sync = vi.fn<(...a: unknown[]) => Promise<{ updated: number; checked: number }>>(async () => ({ updated: 0, checked: 0 }))
vi.mock('@/lib/actions/pool-publicado-sync', () => ({
  syncPoolPublicado: (...a: unknown[]) => sync(...a),
}))
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

import { PoolPublicadoAutoSync } from './pool-publicado-auto-sync'

beforeEach(() => {
  sync.mockReset()
  sync.mockResolvedValue({ updated: 0, checked: 0 })
  refresh.mockClear()
})
afterEach(() => cleanup())

describe('PoolPublicadoAutoSync', () => {
  it('al abrir el Panel pregunta a Metricool una vez; si nada salió, no refresca', async () => {
    render(<PoolPublicadoAutoSync />)
    await waitFor(() => expect(sync).toHaveBeenCalledTimes(1))
    expect(refresh).not.toHaveBeenCalled()
  })

  it('refresca el Panel cuando un Agendado pasa a Publicado', async () => {
    sync.mockResolvedValue({ updated: 1, checked: 4 })
    render(<PoolPublicadoAutoSync />)
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
  })

  it('un fallo de Metricool no rompe el Panel', async () => {
    sync.mockRejectedValue(new Error('metricool down'))
    render(<PoolPublicadoAutoSync />)
    await waitFor(() => expect(sync).toHaveBeenCalled())
    expect(refresh).not.toHaveBeenCalled()
  })
})
