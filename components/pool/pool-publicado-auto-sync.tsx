'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { syncPoolPublicado } from '@/lib/actions/pool-publicado-sync'

/**
 * Al abrir el Panel: pregunta a Metricool si un Agendado ya salió y
 * refresca para mostrar Publicado. Best-effort; no bloquea la página.
 */
export function PoolPublicadoAutoSync() {
  const router = useRouter()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    syncPoolPublicado()
      .then((res) => {
        if (res.updated > 0) router.refresh()
      })
      .catch(() => {
        /* un fallo de Metricool no rompe el Panel */
      })
  }, [router])

  return null
}
