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
