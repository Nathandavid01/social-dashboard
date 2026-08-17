import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Async factory + dynamic import: the fake nav instance is constructed lazily
// when 'next/navigation' is first resolved, not at vi.mock hoist time — so
// there's no TDZ issue referencing a module-scope helper from the factory.
// The mocked module's extra named exports (currentSearch/reset/…) are how the
// test itself reaches back into the same instance the hook is using.
vi.mock('next/navigation', async () => {
  const { createFakeNavigation } = await import('@/tests/fake-next-navigation')
  return createFakeNavigation('/pipeline')
})

import * as nav from 'next/navigation'
import { useOverlayRoute } from './use-overlay-route'

const currentSearch = () => (nav as unknown as { currentSearch: () => string }).currentSearch()
const reset = (s?: string) => (nav as unknown as { reset: (s?: string) => void }).reset(s)
const simulateBrowserBack = () => (nav as unknown as { simulateBrowserBack: () => void }).simulateBrowserBack()

beforeEach(() => {
  reset('')
})

describe('useOverlayRoute', () => {
  it('open() pushes the given params onto the URL', () => {
    const { result } = renderHook(() => useOverlayRoute())
    act(() => result.current.open({ lote: 'client-1' }))
    expect(currentSearch()).toBe('lote=client-1')
  })

  it('close() pops the pushed entry via back() when we pushed it', () => {
    const { result, rerender } = renderHook(() => useOverlayRoute())
    act(() => result.current.open({ lote: 'client-2' }))
    rerender()
    expect(currentSearch()).toBe('lote=client-2')

    act(() => result.current.close(['lote']))
    expect(currentSearch()).toBe('')
  })

  it('close() is idempotent — calling it twice in a row does not pop past an empty URL', () => {
    const { result, rerender } = renderHook(() => useOverlayRoute())
    act(() => result.current.open({ lote: 'client-3' }))
    rerender()

    act(() => result.current.close(['lote']))
    expect(currentSearch()).toBe('')
    // Second close: nothing of ours is open anymore → no-op, does not call
    // back() again (which, if it did and there were an earlier real entry,
    // would strand the user off the board).
    act(() => result.current.close(['lote']))
    expect(currentSearch()).toBe('')
  })

  it('close() replaces (not back()) on a deep link — nothing of ours to pop', () => {
    // Simulate landing directly on a URL that already has the overlay open —
    // a fresh page load, single history entry, nothing pushed by this hook.
    reset('lote=client-4')
    const { result } = renderHook(() => useOverlayRoute())

    act(() => result.current.close(['lote']))
    // If this had wrongly called router.back() at index 0 (nothing to pop),
    // the fake router's back() is a no-op and the param would still be there.
    expect(currentSearch()).toBe('')
  })

  it('markClosed() resets the "pushed" bookkeeping so a later close() replaces instead of going back', () => {
    const { result, rerender } = renderHook(() => useOverlayRoute())
    act(() => result.current.open({ lote: 'client-5' }))
    rerender()

    act(() => result.current.markClosed())
    // Simulate the physical back button: it already popped our entry, without
    // going through close().
    act(() => simulateBrowserBack())
    rerender()
    expect(currentSearch()).toBe('')

    // A subsequent close() call (e.g. Escape fired right after) must be a
    // no-op — there is nothing open anymore.
    act(() => result.current.close(['lote']))
    expect(currentSearch()).toBe('')
  })

  it('open() merges onto the existing search instead of clobbering unrelated params', () => {
    reset('foo=bar')
    const { result } = renderHook(() => useOverlayRoute())
    act(() => result.current.open({ lote: 'client-6' }))
    const params = new URLSearchParams(currentSearch())
    expect(params.get('foo')).toBe('bar')
    expect(params.get('lote')).toBe('client-6')
  })
})
