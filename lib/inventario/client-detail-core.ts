/**
 * Client profile for /inventario: the next two weeks of their calendar and the
 * posts behind it. Pure — the server action feeds rows in.
 *
 * Calendar day kinds:
 *   publicado  → a post went out that day
 *   agendado   → scheduled in Metricool for that day (publish_date)
 *   proyectado → a posting day an unscheduled ready cut would fill, in order
 *   vacio      → a posting day with nothing to publish
 *   libre      → not a posting day, nothing dated on it
 */
import { isAgendadoIdea, isPublishedIdea } from '@/lib/utils/client-pool-state'
import { addDaysISO, todayISOInTimeZone } from '@/lib/utils/deadlines'
import { POST_TZ } from '@/lib/utils/idea-lab-send-core'
import { ideaFormat, type Format } from './cadence-formats'
import type { ScheduledSlot } from './metricool-scheduled-core'

export type DayKind = 'publicado' | 'agendado' | 'proyectado' | 'vacio' | 'libre'
export type PostStage = 'publicado' | 'agendado' | 'listo'

export interface DetailVideo {
  id: string
  kind?: string | null
  status?: string | null
  uploaded_at?: string | null
}

export interface DetailIdea {
  id: string
  title: string | null
  status: string
  publish_date?: string | null
  published_at?: string | null
  manual_posted_status?: string | null
  metricool_post_id?: number | null
  posted_at?: string | null
  content_type?: string | null
  videos?: DetailVideo[] | null
}

export interface CalendarDay {
  date: string
  /** JS weekday 0=Sun..6=Sat. */
  weekday: number
  posting: boolean
  /** What this posting day takes (reel/post/story); null = either or not a posting day. */
  format: Format | null
  kind: DayKind
  postId: string | null
  title: string | null
}

export interface DetailPost {
  id: string
  title: string
  stage: PostStage
  format: Format
  /** Day it went / goes out; for a ready cut, the posting day it would fill. */
  date: string | null
  coverVideoId: string | null
}

export interface ClientDetail {
  calendar: CalendarDay[]
  upcoming: DetailPost[]
  recent: DetailPost[]
  crudo: number
}

export const CALENDAR_DAYS = 14
const RECENT_DAYS = 30
const PROJECTION_DAYS = 180

function usable(v: DetailVideo): boolean {
  return v.status !== 'archived' && v.status !== 'failed'
}

function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

function editedVideo(idea: DetailIdea): DetailVideo | null {
  return (idea.videos ?? []).find((v) => usable(v) && v.kind === 'edited') ?? null
}

function titleOf(idea: DetailIdea): string {
  return idea.title?.trim() || 'Sin título'
}

export function buildClientDetail(
  ideas: DetailIdea[],
  postingDays: number[] | null,
  today: string,
  formats?: Partial<Record<number, Format | null>>,
  /** Pending posts from the Metricool planner, including hand-made ones. */
  plannerPosts: ScheduledSlot[] = [],
): ClientDetail {
  const cadence = new Set((postingDays ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))
  const live = ideas.filter((i) => i.status !== 'descartada')

  const published: DetailPost[] = []
  const scheduled: DetailPost[] = []
  const ready: DetailIdea[] = []
  let crudo = 0

  for (const idea of live) {
    const cut = editedVideo(idea)
    if (isPublishedIdea(idea)) {
      // published_at is a UTC timestamp; the calendar is Puerto Rico days.
      const date = idea.published_at
        ? todayISOInTimeZone(POST_TZ, new Date(idea.published_at))
        : idea.publish_date?.slice(0, 10) || null
      published.push({ id: idea.id, title: titleOf(idea), stage: 'publicado', format: ideaFormat(idea.content_type), date, coverVideoId: cut?.id ?? null })
    } else if (isAgendadoIdea(idea)) {
      const date = idea.publish_date?.slice(0, 10) || null
      // Scheduled for a day already gone (or with no date) = it went out; the
      // inventory card counts it the same way.
      if (!date || date < today) {
        published.push({ id: idea.id, title: titleOf(idea), stage: 'publicado', format: ideaFormat(idea.content_type), date, coverVideoId: cut?.id ?? null })
      } else {
        scheduled.push({ id: idea.id, title: titleOf(idea), stage: 'agendado', format: ideaFormat(idea.content_type), date, coverVideoId: cut?.id ?? null })
      }
    } else if (cut) {
      ready.push(idea)
    } else if ((idea.videos ?? []).some((v) => usable(v) && (v.kind === 'raw' || v.kind === 'broll'))) {
      crudo++
    }
  }

  // Planner posts the dashboard doesn't know yet (made by hand in Metricool).
  const known = new Set(live.map((i) => i.metricool_post_id).filter((id) => id != null).map(Number))
  for (const slot of plannerPosts) {
    if (known.has(slot.id)) continue
    scheduled.push({ id: `mc-${slot.id}`, title: slot.title, stage: 'agendado', format: slot.format, date: slot.date, coverVideoId: null })
  }

  // Dated posts own their day.
  const byDate = new Map<string, DetailPost>()
  for (const p of [...published, ...scheduled]) if (p.date && !byDate.has(p.date)) byDate.set(p.date, p)

  // Ready cuts fill the free posting days in order (planned date first).
  ready.sort((a, b) => (a.publish_date ?? '9999').localeCompare(b.publish_date ?? '9999'))
  const projected = new Map<string, DetailIdea>()
  const projectedDate = new Map<string, string>()
  const formatOf = (wd: number): Format | null => (cadence.has(wd) ? formats?.[wd] ?? null : null)
  // A reel day takes a ready reel, a post day a ready post; an open day takes the next one.
  const isReel = (i: DetailIdea) => ideaFormat(i.content_type) === 'reel'
  if (cadence.size > 0) {
    const pool = [...ready]
    for (let i = 0; i < PROJECTION_DAYS && pool.length > 0; i++) {
      const date = addDaysISO(today, i)
      const wd = weekdayOf(date)
      if (!cadence.has(wd) || byDate.has(date)) continue
      const f = formatOf(wd)
      // An open day takes a reel first, like the inventory card's walk.
      const idx = f === null ? Math.max(0, pool.findIndex(isReel)) : pool.findIndex((x) => (f === 'reel') === isReel(x))
      if (idx < 0) continue
      const [pick] = pool.splice(idx, 1)
      projected.set(date, pick)
      projectedDate.set(pick.id, date)
    }
  }

  const calendar: CalendarDay[] = []
  for (let i = 0; i < CALENDAR_DAYS; i++) {
    const date = addDaysISO(today, i)
    const weekday = weekdayOf(date)
    const posting = cadence.has(weekday)
    const dated = byDate.get(date)
    const filler = projected.get(date)
    if (dated) {
      calendar.push({ date, weekday, posting, format: formatOf(weekday), kind: dated.stage === 'publicado' ? 'publicado' : 'agendado', postId: dated.id, title: dated.title })
    } else if (filler) {
      calendar.push({ date, weekday, posting, format: formatOf(weekday), kind: 'proyectado', postId: filler.id, title: titleOf(filler) })
    } else {
      calendar.push({ date, weekday, posting, format: formatOf(weekday), kind: posting ? 'vacio' : 'libre', postId: null, title: null })
    }
  }

  const upcoming: DetailPost[] = [
    ...scheduled.sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999')),
    ...ready.map((idea) => ({
      id: idea.id,
      title: titleOf(idea),
      stage: 'listo' as const,
      format: ideaFormat(idea.content_type),
      date: projectedDate.get(idea.id) ?? null,
      coverVideoId: editedVideo(idea)?.id ?? null,
    })),
  ]

  const since = addDaysISO(today, -RECENT_DAYS)
  const recent = published
    .filter((p) => p.date && p.date >= since)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

  return { calendar, upcoming, recent, crudo }
}
