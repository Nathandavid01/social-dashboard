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

/** Eric 2026-10-18: include current graphics and videos; exclude revisions and reservations. */
export function projectReciboVideos(ideas: IdeaWithPipeline[], today: string, postingDays: number[], occupiedDays: string[], postingSchedule?: Record<string, string> | null, postingTime?: string | null, nowTime?: string) {
  const occupied = new Set(occupiedDays)
  const days = new Set(postingDays.filter(day => Number.isInteger(day) && day >= 0 && day <= 6))
  const seen = new Set<string>()
  const pieces = ideas.flatMap(idea => {
    if (seen.has(idea.id) || !belongsOnRecibo(idea)) return []
    const id = editedEntregasVideoId(idea)
    const video = idea.videos?.find(video => video.id === id)
    if (!video) return []
    const image = video.mime_type?.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(video.name ?? '')
    if (!image && !(video.mime_type?.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(video.name ?? ''))) return []
    seen.add(idea.id)
    return [{ idea, videoId: id!, image: !!image }]
  }).sort((a, b) => (a.idea.created_at ?? '').localeCompare(b.idea.created_at ?? '') || a.idea.id.localeCompare(b.idea.id))
  // Eric 2026-10-19: removed from the calendar = still in Recibo, but no date and no count.
  const queue = pieces.filter(item => !item.idea.calendar_hidden_at)
  const hidden = pieces.filter(item => !!item.idea.calendar_hidden_at)
  const remaining = [...queue]
  const posts: { date: string; idea: IdeaWithPipeline; videoId: string; image: boolean }[] = []
  for (let offset = 0; offset < 366 && remaining.length > 0 && days.size; offset++) {
    const date = shiftCalendarDay(today, offset)
    const slot = calendarCadenceSlot({ posting_days: [...days], posting_schedule: postingSchedule, posting_time: postingTime }, new Date(`${date}T12:00:00Z`).getUTCDay())
    if (occupied.has(date) || !slot || slot.format === 'Story') continue
    if (date === today && nowTime && slot.time && slot.time <= nowTime) continue
    const index = remaining.findIndex(item => !slot.format || slot.format === (item.image ? 'Post' : 'Reel'))
    if (index < 0) continue
    const [item] = remaining.splice(index, 1)
    posts.push({ date, ...item })
  }
  return { posts, total: queue.length, unplaced: remaining, hidden, overflow: remaining.length, through: posts.at(-1)?.date ?? null }
}
