import type { IdeaWithPipeline } from '@/lib/supabase/types'
import { editedEntregasVideoId } from './preview'
import { belongsOnRecibo } from './board-ideas'
import { calendarCadenceSlot } from '@/lib/published/calendar-cadence'

export const calendarDate = (date: Date) => date.toISOString().slice(0, 10)
export const shiftCalendarDay = (day: string, offset: number) => {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return calendarDate(date)
}
export const calendarWeekStart = (day: string) => shiftCalendarDay(day, -new Date(`${day}T12:00:00Z`).getUTCDay())

/** One current playable video per idea; never count graphics, revisions or reservations. */
export function projectReciboVideos(ideas: IdeaWithPipeline[], today: string, postingDays: number[], occupiedDays: string[], postingSchedule?: Record<string, string> | null, postingTime?: string | null, nowTime?: string) {
  const occupied = new Set(occupiedDays)
  const days = new Set(postingDays.filter(day => Number.isInteger(day) && day >= 0 && day <= 6))
  const seen = new Set<string>()
  const queue = ideas.filter(idea => {
    if (seen.has(idea.id) || !belongsOnRecibo(idea)) return false
    const id = editedEntregasVideoId(idea)
    const video = idea.videos?.find(video => video.id === id)
    if (!video || !(video.mime_type?.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(video.name ?? ''))) return false
    seen.add(idea.id)
    return true
  }).sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.id.localeCompare(b.id))
  const posts: { date: string; idea: IdeaWithPipeline; videoId: string }[] = []
  for (let offset = 0; offset < 366 && posts.length < queue.length && days.size; offset++) {
    const date = shiftCalendarDay(today, offset)
    const slot = calendarCadenceSlot({ posting_days: [...days], posting_schedule: postingSchedule, posting_time: postingTime }, new Date(`${date}T12:00:00Z`).getUTCDay())
    if (occupied.has(date) || !slot || (slot.format && slot.format !== 'Reel')) continue
    if (date === today && nowTime && slot.time && slot.time <= nowTime) continue
    const idea = queue[posts.length]
    posts.push({ date, idea, videoId: editedEntregasVideoId(idea)! })
  }
  return { posts, total: queue.length, overflow: queue.length - posts.length, through: posts.at(-1)?.date ?? null }
}
