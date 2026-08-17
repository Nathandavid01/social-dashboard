'use client'

import { useEffect, useRef } from 'react'
import { recordHeartbeat } from '@/lib/actions/presence'
import { PRESENCE_BEAT_MS } from '@/lib/utils/presence-core'

/**
 * Latido de jornada: cada 60s si la pestaña está visible, y al ocultar
 * (para no perder el último tramo). Si la pestaña está escondida, no late
 * — dejar el dashboard abierto en segundo plano no infla las horas.
 */
export function PresenceHeartbeat() {
  const beating = useRef(false)

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined

    const beat = () => {
      if (beating.current) return
      beating.current = true
      void recordHeartbeat().finally(() => { beating.current = false })
    }

    const start = () => {
      if (timer) return
      beat()
      timer = setInterval(() => {
        if (document.visibilityState === 'visible') beat()
      }, PRESENCE_BEAT_MS)
    }

    const stop = () => {
      if (timer) {
        clearInterval(timer)
        timer = undefined
      }
    }

    const onVis = () => {
      if (document.visibilityState === 'visible') start()
      else {
        beat()
        stop()
      }
    }

    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', beat)

    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', beat)
      stop()
    }
  }, [])

  return null
}
