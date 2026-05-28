'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

/**
 * Subtle top progress bar (NProgress-style) that flashes on every route change.
 * Complements the full-screen NateLoader: this catches fast client-side
 * navigations where Suspense / loading.tsx wouldn't fire.
 */
export function NateTopProgress() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let mounted = true
    setVisible(true)
    setProgress(12)

    const t1 = window.setTimeout(() => mounted && setProgress(40), 120)
    const t2 = window.setTimeout(() => mounted && setProgress(70), 260)
    const t3 = window.setTimeout(() => mounted && setProgress(92), 480)
    const t4 = window.setTimeout(() => mounted && setProgress(100), 720)
    const t5 = window.setTimeout(() => {
      if (!mounted) return
      setVisible(false)
      setProgress(0)
    }, 1050)

    return () => {
      mounted = false
      ;[t1, t2, t3, t4, t5].forEach(clearTimeout)
    }
  }, [pathname])

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px] transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      aria-hidden="true"
    >
      <div
        className="h-full bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-500 shadow-[0_0_8px_rgba(212,160,23,0.7)]"
        style={{ width: `${progress}%`, transition: 'width 320ms cubic-bezier(0.22, 1, 0.36, 1)' }}
      />
    </div>
  )
}
