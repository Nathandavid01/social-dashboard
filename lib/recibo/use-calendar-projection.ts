'use client'

import { useEffect, useState } from 'react'
import type { IdeaWithPipeline } from '@/lib/supabase/types'
import type { PublishedPost } from '@/app/api/metricool/posts/route'
import { calendarPostDate, calendarPostState } from '@/lib/published/calendar-post'
import type { CalendarCadence } from '@/lib/published/calendar-cadence'
import { projectReciboVideos, shiftCalendarDay } from './calendar-projection'

type Projection = ReturnType<typeof projectReciboVideos>
const EMPTY_IDEAS: IdeaWithPipeline[] = []

/** Coverage is isolated from the visible calendar; fetch only as far as the queue needs. */
export function useReciboProjection(ideas: IdeaWithPipeline[] | undefined, client: (CalendarCadence & { id: string; metricool_blog_id: string | null }) | undefined, now: string, refresh: number) {
  const [state, setState] = useState<{ scope: string; projection: Projection | null; error: string | null }>({ scope: '', projection: null, error: null })
  const id = client?.id, blog = client?.metricool_blog_id
  const days = client?.posting_days, schedule = client?.posting_schedule, time = client?.posting_time
  const today = now.slice(0, 10), nowTime = now.slice(11, 16)
  const scope = JSON.stringify([id, blog, days, schedule, time, today, nowTime, refresh])
  const source = ideas ?? EMPTY_IDEAS
  useEffect(() => {
    const controller = new AbortController()
    setState({ scope, projection: null, error: null })
    if (!ideas || !id || !blog) return () => controller.abort()
    const queue = source.filter(idea => idea.client_id === id)
    const project = (occupied: string[]) => projectReciboVideos(queue, today, days ?? [], occupied, schedule, time, nowTime)
    const initial = project([])
    if (!initial.total || !initial.posts.length) {
      setState({ scope, projection: initial, error: null })
      return () => controller.abort()
    }
    async function load() {
      const occupied: string[] = []
      for (let offset = 0; offset < 366; offset += 35) {
        const end = shiftCalendarDay(today, Math.min(offset + 34, 365))
        const params = new URLSearchParams({ clientId: id!, startDate: shiftCalendarDay(today, offset), endDate: end, includeDrafts: 'true' })
        const response = await fetch(`/api/metricool/posts?${params}`, { signal: controller.signal, cache: 'no-store' })
        if (!response.ok) throw Error('coverage unavailable')
        const data = await response.json()
        if (data.complete === false || data.failedClients?.length || !Array.isArray(data.posts)) throw Error('coverage incomplete')
        const posts = data.posts as PublishedPost[]
        occupied.push(...posts.filter(post => ['published', 'scheduled', 'partial'].includes(calendarPostState(post))).map(post => calendarPostDate(post).slice(0, 10)))
        const result = project(occupied)
        if (!result.posts.length || (result.through && result.through <= end) || offset + 35 >= 366) {
          if (!controller.signal.aborted) setState({ scope, projection: result, error: null })
          return
        }
      }
    }
    void load().catch(() => {
      if (!controller.signal.aborted) setState({ scope, projection: null, error: 'No se pudo verificar la cobertura. Las publicaciones del calendario se consultan por separado.' })
    })
    return () => controller.abort()
  }, [source, !!ideas, id, blog, days, schedule, time, today, nowTime, refresh, scope])
  return state.scope === scope ? state : { scope, projection: null, error: null }
}
