'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { syncMetricoolPublished } from '@/lib/actions/metricool-sync'

/**
 * Fire-and-forget: when the board is viewed, pull Metricool's publish status in
 * the background and refresh the board if any card moved to Publication — so a
 * video that just went live shows where it ended up, without blocking the page.
 * Renders nothing.
 */
export function MetricoolAutoSync() {
  const router = useRouter()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    syncMetricoolPublished()
      .then((res) => {
        if (res.updated > 0) router.refresh()
      })
      .catch(() => {
        /* best-effort — a Metricool hiccup never breaks the board */
      })
  }, [router])

  return null
}
