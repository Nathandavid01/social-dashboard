'use client'

import { useEffect, useState } from 'react'
import { getVideoAnalysis, type VideoAnalysisView } from '@/lib/actions/video-analysis'

const POLL_MS = 10_000
const POLL_GIVE_UP_MS = 5 * 60_000

/**
 * Fetch + poll shared by every consumer of `getVideoAnalysis` (el reporte de
 * detalle y la tira de bolitas QC). Mientras el análisis está 'pending'
 * reconsulta cada 10s hasta que el estado cambie, se desmonte, o pasen ~5min
 * (ahí se da por vencido y deja el último estado visto — nunca inventa un
 * error). Un solo hook = un solo fetch/poll por punto de montaje.
 *
 * `keepPolling` extiende esa condición más allá de 'pending' (mismo tope de
 * ~5min): `/api/video-analysis` hace upsert 'done' y LUEGO llama a
 * `generateIdeaCaption`, así que hay una ventana real donde el análisis ya
 * está 'done' pero el caption todavía no existe — sin este predicado la 3ra
 * bolita ("Generando caption…") se queda pulsando para siempre. Quien no lo
 * pasa (p.ej. `VideoAnalysisReport` si se monta solo) mantiene el
 * comportamiento de siempre: para de sondear en cuanto sale de 'pending'.
 */
export function useVideoAnalysisPolling(
  ideaId: string,
  keepPolling?: (analysis: VideoAnalysisView) => boolean,
): VideoAnalysisView | null | undefined {
  const [analysis, setAnalysis] = useState<VideoAnalysisView | null | undefined>(undefined)

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout> | null = null
    const startedAt = Date.now()

    const fetchOnce = () => {
      getVideoAnalysis(ideaId)
        .then((res) => {
          if (!alive) return
          const next = res.analysis ?? null
          setAnalysis(next)
          const shouldPoll = !!next && (next.status === 'pending' || !!keepPolling?.(next))
          if (shouldPoll && Date.now() - startedAt < POLL_GIVE_UP_MS) {
            timer = setTimeout(fetchOnce, POLL_MS)
          }
        })
        .catch(() => { if (alive) setAnalysis(null) })
    }
    fetchOnce()

    return () => {
      alive = false
      if (timer) clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keepPolling se pasa como closure estable desde cada llamador (arrow inline); no se re-suscribe por cambios de identidad, solo por ideaId.
  }, [ideaId])

  return analysis
}
