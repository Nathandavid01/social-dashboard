import { useEffect, useState } from 'react'

/**
 * Minimal reactive fake of the `next/navigation` App Router hooks, for tests
 * that need `push`/`replace`/`back` to actually change what `useSearchParams()`
 * returns (and re-render the component under test) — e.g. the overlay-in-URL
 * flow in ContentPipelineBoard/EntregasBoard, where "back closes the overlay"
 * is the exact behavior under test.
 *
 * Usage:
 *   const nav = createFakeNavigation()
 *   vi.mock('next/navigation', () => nav)
 *   ...
 *   nav.simulateBrowserBack() // in a test, to assert the overlay closes
 */
export function createFakeNavigation(pathname = '/pipeline') {
  let stack: string[] = ['']
  let index = 0
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((l) => l())
  const qsOf = (url: string) => (url.includes('?') ? url.slice(url.indexOf('?') + 1) : '')

  function navigate(url: string, mode: 'push' | 'replace') {
    const qs = qsOf(url)
    if (mode === 'push') {
      stack = stack.slice(0, index + 1)
      stack.push(qs)
      index++
    } else {
      stack[index] = qs
    }
    notify()
  }

  function back() {
    if (index > 0) {
      index--
      notify()
    }
  }

  function useSearchParamsMock() {
    const [, force] = useState(0)
    useEffect(() => {
      const l = () => force((n) => n + 1)
      listeners.add(l)
      return () => { listeners.delete(l) }
    }, [])
    return new URLSearchParams(stack[index])
  }

  return {
    useRouter: () => ({
      push: (url: string) => navigate(url, 'push'),
      replace: (url: string) => navigate(url, 'replace'),
      back,
      forward: () => { if (index < stack.length - 1) { index++; notify() } },
      refresh: () => {},
    }),
    usePathname: () => pathname,
    useSearchParams: useSearchParamsMock,
    /** Test-only: simulates the user pressing the browser/trackpad back button. */
    simulateBrowserBack: back,
    /** Test-only: current query string, without the leading '?'. */
    currentSearch: () => stack[index],
    /** Test-only: resets history to a single entry, e.g. a deep link that
     * lands with the overlay already open — nothing of "ours" was pushed. */
    reset: (initialSearch = '') => {
      stack = [initialSearch]
      index = 0
      notify()
    },
  }
}
