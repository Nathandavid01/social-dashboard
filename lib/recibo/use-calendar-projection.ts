'use client'

import { useEffect, useRef, useState } from 'react'
import type { IdeaWithPipeline } from '@/lib/supabase/types'
import type { PublishedPost } from '@/app/api/metricool/posts/route'
import type { CalendarCadence } from '@/lib/published/calendar-cadence'
import { shiftCalendarDay } from './calendar-projection'
import { buildCalendarCoverage } from './calendar-coverage'

type Projection = ReturnType<typeof buildCalendarCoverage>
const EMPTY_IDEAS: IdeaWithPipeline[] = []

/** Coverage is isolated from the visible calendar; verify the next 366 days, including dates after the queue ends. */
export function useReciboProjection(ideas: IdeaWithPipeline[] | undefined, client: (CalendarCadence & { id: string; metricool_blog_id: string | null }) | undefined, now: string, refresh: number) {
  const [state, setState] = useState<{ scope: string; projection: Projection | null; error: string | null; verifying: boolean }>({ scope: '', projection: null, error: null, verifying: false })
  const id = client?.id, blog = client?.metricool_blog_id
  const days = client?.posting_days, schedule = client?.posting_schedule, time = client?.posting_time
  const clock = useRef(now)
  clock.current = now
  const today = now.slice(0, 10)
  const scope = JSON.stringify([id, blog, days, schedule, time, today])
  const source = ideas ?? EMPTY_IDEAS
  useEffect(() => {
    const controller = new AbortController()
    // Preserve playable cards during refresh, but never label the previous date as freshly verified.
    setState(previous => ({ scope, projection: previous.scope === scope ? previous.projection : null, error: null, verifying: !!ideas && !!id && !!blog }))
    if (!ideas || !id || !blog || !client) return () => controller.abort()
    async function load() {
      const allPosts: PublishedPost[] = []
      for (let offset = 0; offset < 366; offset += 35) {
        const end = shiftCalendarDay(today, Math.min(offset + 34, 365))
        const params = new URLSearchParams({ clientId: id!, startDate: shiftCalendarDay(today, offset), endDate: end, includeDrafts: 'true' })
        const response = await fetch(`/api/metricool/posts?${params}`, { signal: controller.signal, cache: 'no-store' })
        if (!response.ok) throw Error('coverage unavailable')
        const data = await response.json()
        if (data.complete === false || data.failedClients?.length || !Array.isArray(data.posts)) throw Error('coverage incomplete')
        allPosts.push(...data.posts as PublishedPost[])
      }
      if (!controller.signal.aborted) {
        setState({ scope, projection: buildCalendarCoverage(source, client!, allPosts, clock.current), error: null, verifying: false })
      }
    }
    void load().catch(() => {
      if (!controller.signal.aborted) setState({ scope, projection: null, error: 'No se pudo verificar la cobertura. Las publicaciones del calendario se consultan por separado.', verifying: false })
    })
    return () => controller.abort()
  }, [source, !!ideas, id, blog, days, schedule, time, today, refresh, scope])
  return state.scope === scope ? state : { scope, projection: null, error: null, verifying: !!ideas && !!id && !!blog }
}
