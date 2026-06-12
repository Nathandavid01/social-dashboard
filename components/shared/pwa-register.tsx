'use client'

import { useEffect } from 'react'

/** Registers the service worker (production only) so the app is installable and works offline. */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // best-effort: a failed registration must never break the app
    })
  }, [])
  return null
}
