import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'

const recordHeartbeat = vi.fn(async () => ({ ok: true as const }))
vi.mock('@/lib/actions/presence', () => ({
  recordHeartbeat: () => recordHeartbeat(),
}))

import { PresenceHeartbeat } from './presence-heartbeat'
import { PRESENCE_BEAT_MS } from '@/lib/utils/presence-core'

describe('PresenceHeartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    recordHeartbeat.mockClear()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('late al montar y otra vez al cumplir el intervalo, solo si está visible', async () => {
    render(<PresenceHeartbeat />)
    await act(async () => { await Promise.resolve() })
    expect(recordHeartbeat).toHaveBeenCalledTimes(1)

    await act(async () => { vi.advanceTimersByTime(PRESENCE_BEAT_MS) })
    expect(recordHeartbeat).toHaveBeenCalledTimes(2)
  })

  it('al ocultar la pestaña late una última vez y luego se calla', async () => {
    render(<PresenceHeartbeat />)
    await act(async () => { await Promise.resolve() })
    recordHeartbeat.mockClear()

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(recordHeartbeat).toHaveBeenCalledTimes(1)

    await act(async () => { vi.advanceTimersByTime(PRESENCE_BEAT_MS * 3) })
    expect(recordHeartbeat).toHaveBeenCalledTimes(1)
  })
})
