'use client'

import { useCallback, useRef } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

/**
 * Keeps a full-screen overlay's "what's open" state in the URL so the
 * browser/trackpad back gesture — and Escape — close it instead of leaving
 * the board entirely. Consumers derive their open state straight from
 * `searchParams` (the URL is the source of truth), rather than mirroring it
 * into local React state — that's what makes popstate (the physical back
 * button) "just work": Next re-renders with the new searchParams on its own.
 *
 * - `open(params)` pushes the given params onto the current search string
 *   (scroll:false) and remembers that WE pushed this entry.
 * - `close(keys)` removes those keys. If we're the ones who pushed the
 *   current overlay entry, it calls `router.back()` — popping exactly the
 *   entry we added, so back/forward never end up with an extra "closed
 *   overlay" entry. Otherwise (a reload or a deep link landed here with the
 *   params already in the URL — there is no entry of ours to pop) it strips
 *   the params via `router.replace()` instead.
 * - `close` is idempotent: if none of `keys` are present in the URL anymore,
 *   it's a no-op. Two Escape keydowns (or an overlay's own Escape handler
 *   firing alongside a board-level one) must never pop twice — the second
 *   pop would carry the user past the board itself.
 * - `markClosed()` resets the "we pushed it" bookkeeping. Call it from a
 *   consumer's effect keyed on the derived open-id becoming falsy, so a
 *   physical back-button press (which never goes through `close`) doesn't
 *   leave the bookkeeping pointing at an entry that's already gone.
 */
export function useOverlayRoute() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const pushedRef = useRef(false)

  const open = useCallback(
    (params: Record<string, string | null | undefined>) => {
      const next = new URLSearchParams(searchParams.toString())
      for (const [k, v] of Object.entries(params)) {
        if (v === null || v === undefined || v === '') next.delete(k)
        else next.set(k, v)
      }
      pushedRef.current = true
      router.push(`${pathname}?${next.toString()}`, { scroll: false })
    },
    [router, pathname, searchParams],
  )

  const close = useCallback(
    (keys: string[]) => {
      const stillOpen = keys.some((k) => searchParams.has(k))
      if (!stillOpen) return // idempotent — nothing of ours is open

      if (pushedRef.current) {
        pushedRef.current = false
        router.back()
        return
      }
      const next = new URLSearchParams(searchParams.toString())
      for (const k of keys) next.delete(k)
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname, searchParams],
  )

  const markClosed = useCallback(() => {
    pushedRef.current = false
  }, [])

  return { searchParams, open, close, markClosed }
}
