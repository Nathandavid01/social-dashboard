import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createThrottle } from './throttle'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('createThrottle', () => {
  it('la primera llamada va al momento; las siguientes dentro de la ventana se juntan en una al final', () => {
    const fn = vi.fn()
    const t = createThrottle(fn, 10_000)
    t.call()
    expect(fn).toHaveBeenCalledTimes(1)
    t.call()
    t.call()
    expect(fn).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(10_000)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('pasada la ventana, vuelve a ir al momento', () => {
    const fn = vi.fn()
    const t = createThrottle(fn, 1000)
    t.call()
    vi.advanceTimersByTime(1500)
    t.call()
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('cancel descarta la llamada pendiente', () => {
    const fn = vi.fn()
    const t = createThrottle(fn, 1000)
    t.call()
    t.call()
    t.cancel()
    vi.advanceTimersByTime(5000)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
