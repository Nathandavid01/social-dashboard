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
 */
export function useVideoAnalysisPolling(ideaId: string): VideoAnalysisView | null | undefined {
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
          if (next?.status === 'pending' && Date.now() - startedAt < POLL_GIVE_UP_MS) {
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
  }, [ideaId])

  return analysis
}
