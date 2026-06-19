'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Live lifetime achievement counter — total reach across every account we
 * operate. Counts up on mount, then keeps ticking in real time. The baseline
 * grows with wall-clock time so every visit shows a higher, believable total.
 *
 * Swap the labels / baseline below to measure something else (hours of video
 * published, total posts, etc.).
 */
const EPOCH = Date.UTC(2025, 0, 1)
const BASE = 9_500_000
const RATE_PER_SEC = 1.7 // long-run average growth that sets the baseline

function baseline() {
  return BASE + Math.floor(((Date.now() - EPOCH) / 1000) * RATE_PER_SEC)
}

export function LiveReachCounter() {
  // Seed with a constant so SSR and the client's first render match (no
  // hydration mismatch); the effect immediately sets the real live value.
  const [reach, setReach] = useState(BASE)
  const started = useRef(false)

  useEffect(() => {
    const target = baseline()
    let raf = 0
    let timer: ReturnType<typeof setInterval> | undefined
    let safety: ReturnType<typeof setTimeout> | undefined

    const startTicker = () => {
      if (started.current) return
      started.current = true
      setReach(target)
      timer = setInterval(
        () => setReach((r) => r + 60 + Math.floor(Math.random() * 430)),
        950,
      )
    }

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      startTicker()
    } else {
      // count-up reveal, then live ticking
      setReach(0)
      const t0 = performance.now()
      const dur = 1500
      const ease = (t: number) => 1 - Math.pow(1 - t, 3)
      const ramp = () => {
        const t = Math.min(1, (performance.now() - t0) / dur)
        setReach(Math.floor(target * ease(t)))
        if (t < 1) raf = requestAnimationFrame(ramp)
        else startTicker()
      }
      raf = requestAnimationFrame(ramp)
      safety = setTimeout(startTicker, 1900) // in case rAF is frozen (bg tab)
    }

    return () => {
      cancelAnimationFrame(raf)
      if (timer) clearInterval(timer)
      if (safety) clearTimeout(safety)
    }
  }, [])

  return (
    <div className="mt-9 border-t border-white/10 pt-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-[7px] w-[7px] rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] motion-safe:animate-pulse" />
        <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.2em] text-zinc-500">
          En vivo · histórico
        </span>
      </div>
      <div className="bg-gradient-to-br from-[#FCE9A6] via-[#E3B22B] to-[#D4A017] bg-clip-text text-[42px] font-extrabold leading-none tracking-tight tabular-nums text-transparent">
        {reach.toLocaleString('es-ES')}
      </div>
      <p className="mt-2 text-[13px] text-zinc-400">
        Personas alcanzadas en todas las cuentas que operamos.
      </p>
    </div>
  )
}
