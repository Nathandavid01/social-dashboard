'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/lib/hooks/use-toast'
import { syncReciboPublished } from '@/lib/actions/recibo'

/**
 * Runs the Metricool match once Recibo is on screen (not before: the page
 * renders at its usual speed) and reloads it if anything already left.
 */
export function ReciboPublishedSync() {
  const router = useRouter()
  const { toast } = useToast()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    syncReciboPublished()
      .then(({ linked }) => {
        if (!linked) return
        toast({
          title: linked === 1
            ? '1 video ya estaba en Metricool y salió de Recibo'
            : `${linked} videos ya estaban en Metricool y salieron de Recibo`,
        })
        router.refresh()
      })
      .catch(() => {})
  }, [router, toast])

  return null
}
