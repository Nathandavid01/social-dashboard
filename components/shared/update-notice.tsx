'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { APP_VERSION } from '@/lib/version'

/**
 * Aviso "hay una versión nueva" del dashboard.
 *
 * El bundle del navegador lleva compilado su APP_VERSION; cada deploy a Vercel
 * cambia el del servidor. Se compara contra /api/version al montar, al volver
 * el foco a la pestaña y cada 5 minutos — las pestañas de este equipo viven
 * abiertas días, y sin esto nadie se entera de que hay update hasta que algo
 * se ve raro. Ante cualquier fallo de red el aviso simplemente no sale.
 */
const CHECK_INTERVAL_MS = 5 * 60 * 1000

export function UpdateNotice() {
  const [serverVersion, setServerVersion] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    async function check() {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' })
        if (!res.ok) return
        const { version } = (await res.json()) as { version?: string }
        if (alive && typeof version === 'string') setServerVersion(version)
      } catch {
        /* sin red no hay aviso — se reintenta en el próximo tick */
      }
    }
    check()
    const timer = setInterval(check, CHECK_INTERVAL_MS)
    window.addEventListener('focus', check)
    return () => {
      alive = false
      clearInterval(timer)
      window.removeEventListener('focus', check)
    }
  }, [])

  if (!serverVersion || serverVersion === APP_VERSION) return null

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-card px-4 py-2 shadow-lg animate-in fade-in slide-in-from-bottom-1 duration-300">
      <p className="whitespace-nowrap text-xs text-foreground">
        Hay una versión nueva <span className="font-semibold">v{serverVersion}</span>
      </p>
      <button
        type="button"
        onClick={() => location.reload()}
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background transition hover:opacity-90"
      >
        <RefreshCw className="h-3 w-3" aria-hidden />
        Actualizar
      </button>
    </div>
  )
}
