import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'

const sync = vi.fn<(...a: unknown[]) => Promise<{ updated: number; checked: number }>>(async () => ({ updated: 0, checked: 0 }))
vi.mock('@/lib/actions/metricool-sync', () => ({ syncMetricoolPublished: (...a: unknown[]) => sync(...a) }))
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

import { MetricoolAutoSync } from './metricool-auto-sync'

beforeEach(() => {
  sync.mockReset()
  sync.mockResolvedValue({ updated: 0, checked: 0 })
  refresh.mockClear()
})
afterEach(() => cleanup())

describe('MetricoolAutoSync', () => {
  it('syncs once on mount and does not refresh when nothing changed', async () => {
    render(<MetricoolAutoSync />)
    await waitFor(() => expect(sync).toHaveBeenCalledTimes(1))
    expect(refresh).not.toHaveBeenCalled()
  })

  it('refreshes the board when a card moved to Publication', async () => {
    sync.mockResolvedValue({ updated: 2, checked: 5 })
    render(<MetricoolAutoSync />)
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
  })

  it('never throws if the sync fails', async () => {
    sync.mockRejectedValue(new Error('metricool down'))
    render(<MetricoolAutoSync />)
    await waitFor(() => expect(sync).toHaveBeenCalled())
    expect(refresh).not.toHaveBeenCalled()
  })
})
