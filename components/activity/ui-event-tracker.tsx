'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { createUiEventQueue } from '@/lib/utils/ui-event-queue'
import { isIgnoredPath, resolveClick, sanitizePath, type UiEventInput } from '@/lib/utils/ui-events-core'

async function postEvents(events: UiEventInput[]): Promise<void> {
  const res = await fetch('/api/ui-events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ events }),
  })
  if (!res.ok) throw new Error('ui-events')
}

/** Records meaningful clicks + route changes for the authenticated dashboard. */
export function UiEventTracker() {
  const pathname = usePathname()
  const pathRef = useRef(pathname)
  const queueRef = useRef<ReturnType<typeof createUiEventQueue> | null>(null)

  useEffect(() => {
    const q = createUiEventQueue({ send: postEvents })
    queueRef.current = q

    const onClick = (e: MouseEvent) => {
      const ev = resolveClick(e.target, pathRef.current)
      if (ev) q.enqueue(ev)
    }
    const onHide = () => {
      void q.flush()
    }

    document.addEventListener('click', onClick, true)
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onHide)

    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onHide)
      void q.flush()
      q.destroy()
      queueRef.current = null
    }
  }, [])

  useEffect(() => {
    pathRef.current = pathname
    const path = sanitizePath(pathname)
    if (!path || isIgnoredPath(path)) return
    queueRef.current?.enqueue({
      kind: 'navigate',
      path,
      label: path,
      target: null,
    })
  }, [pathname])

  return null
}
