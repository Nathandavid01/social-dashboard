import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createUiEventQueue } from './ui-event-queue'
import { UI_EVENT_FLUSH_MS, UI_EVENT_FLUSH_SIZE, type UiEventInput } from './ui-events-core'

function ev(over: Partial<UiEventInput> = {}): UiEventInput {
  return { kind: 'click', path: '/home', label: 'Ir', target: 'button', ...over }
}

describe('createUiEventQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('flushes after the interval and does not resend an empty queue', async () => {
    const send = vi.fn(async () => {})
    const q = createUiEventQueue({ send })
    q.enqueue(ev())
    expect(send).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(UI_EVENT_FLUSH_MS)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith([ev()])
    await vi.advanceTimersByTimeAsync(UI_EVENT_FLUSH_MS)
    expect(send).toHaveBeenCalledTimes(1)
    q.destroy()
  })

  it('flushes immediately once the batch size is reached', async () => {
    const send = vi.fn(async () => {})
    const q = createUiEventQueue({ send })
    for (let i = 0; i < UI_EVENT_FLUSH_SIZE; i++) {
      q.enqueue(ev({ label: `b${i}` }))
    }
    expect(send).toHaveBeenCalledTimes(1)
    const firstCall = send.mock.calls[0] as unknown as [unknown[]] | undefined
    expect(firstCall?.[0]).toHaveLength(UI_EVENT_FLUSH_SIZE)
    q.destroy()
  })

  it('drops a duplicate click inside the dedupe window', async () => {
    const send = vi.fn(async () => {})
    let now = 1_000
    const q = createUiEventQueue({ send, now: () => now })
    q.enqueue(ev())
    q.enqueue(ev())
    q.flush()
    await Promise.resolve()
    expect(send).toHaveBeenCalledWith([ev()])
    q.destroy()
  })

  it('swallows send failures so the UI is not broken', async () => {
    const send = vi.fn(async () => {
      throw new Error('network')
    })
    const q = createUiEventQueue({ send })
    q.enqueue(ev())
    await expect(q.flush()).resolves.toBeUndefined()
    q.destroy()
  })
})
