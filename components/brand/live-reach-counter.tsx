'use client'

import { useEffect, useState } from 'react'

/**
 * Total reach across every account we operate, from Metricool (last 12 months).
 * Honest by design: it ONLY renders when a real number is available. When the
 * server can't get real data (Metricool not configured, no client blogIds,
 * error) it receives null and renders NOTHING — no fabricated/“live” number.
 */
export function LiveReachCounter({ realReach = null }: { realReach?: number | null }) {
  const isReal = typeof realReach === 'number' && realReach > 0
  const target = isReal ? (realReach as number) : 0
  // Seed with the real target so SSR and the client's first render match.
  const [reach, setReach] = useState(target)

  useEffect(() => {
    if (!isReal) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setReach(target)
      return
    }
    // Count-up reveal to the real total, then hold steady (no fake growth).
    let raf = 0
    setReach(0)
    const t0 = performance.now()
    const dur = 1500
    const ease = (t: number) => 1 - Math.pow(1 - t, 3)
    const ramp = () => {
      const t = Math.min(1, (performance.now() - t0) / dur)
      setReach(Math.floor(target * ease(t)))
      if (t < 1) raf = requestAnimationFrame(ramp)
      else setReach(target)
    }
    raf = requestAnimationFrame(ramp)
    const safety = setTimeout(() => setReach(target), 1900) // bg-tab fallback
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(safety)
    }
  }, [isReal, target])

  if (!isReal) return null

  return (
    <div className="mt-9 border-t border-white/10 pt-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-[7px] w-[7px] rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] motion-safe:animate-pulse" />
        <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.2em] text-zinc-500">
          Alcance · últimos 12 meses
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
