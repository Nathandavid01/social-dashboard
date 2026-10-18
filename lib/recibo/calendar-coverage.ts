import type { IdeaWithPipeline } from '@/lib/supabase/types'
import type { PublishedPost } from '@/app/api/metricool/posts/route'
import type { CalendarCadence } from '@/lib/published/calendar-cadence'
import { calendarPostDate, calendarPostState } from '@/lib/published/calendar-post'
import { projectReciboVideos, shiftCalendarDay } from './calendar-projection'

type CoverageClient = CalendarCadence & { id: string; metricool_blog_id: string | null }

/** Eric 2026-10-18: the end date includes drafts, scheduled posts and pending suggestions. */
export function buildCalendarCoverage(ideas: IdeaWithPipeline[], client: CoverageClient, metricoolPosts: PublishedPost[], now: string) {
  const today = now.slice(0, 10)
  const horizon = shiftCalendarDay(today, 365)
  const seen = new Set<string>()
  const posts = metricoolPosts.filter(post => {
    if (post.clientId !== client.id || post.blogId !== client.metricool_blog_id) return false
    const identity = `${post.blogId}:${post.id}`
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  }).map(post => ({ date: calendarPostDate(post), state: calendarPostState(post) }))
  const occupied = posts.filter(post => ['draft', 'scheduled', 'published', 'partial'].includes(post.state)).map(post => post.date.slice(0, 10))
  const future = posts.filter(post => post.date >= now && post.date.slice(0, 10) <= horizon && ['draft', 'scheduled'].includes(post.state))
  const projection = projectReciboVideos(ideas.filter(idea => idea.client_id === client.id), today, client.posting_days ?? [], occupied, client.posting_schedule, client.posting_time, now.slice(11,16))
  const dates = [...future.map(post => post.date.slice(0, 10)), ...projection.posts.map(post => post.date)].sort()
  return {
    ...projection,
    through: dates.at(-1) ?? null,
    drafts: future.filter(post => post.state === 'draft').length,
    scheduled: future.filter(post => post.state === 'scheduled').length,
  }
}


/** Elapsed calendar days from Puerto Rico today, independent of the week being viewed. */
export function calendarCoverageDuration(through: string | null | undefined, today: string): string | null {
  const dayNumber = (date: string | null | undefined) => {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
    const parsed = new Date(`${date}T00:00:00Z`)
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? parsed.getTime() / 86400000 : null
  }
  const end = dayNumber(through), start = dayNumber(today)
  if (end === null || start === null || end < start) return null
  const remaining = end - start
  if (remaining === 0) return 'Contenido hasta hoy'
  const weeks = Math.floor(remaining / 7), days = remaining % 7
  const parts = [weeks ? `${weeks} ${weeks === 1 ? 'semana' : 'semanas'}` : '', days ? `${days} ${days === 1 ? 'día' : 'días'}` : ''].filter(Boolean)
  return `${parts.join(' y ')} más de contenido`
}
