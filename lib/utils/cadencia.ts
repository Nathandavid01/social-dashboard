// Pure cadence logic for the home "Cadencia" widget. NO server imports here —
// this file is imported by the client component for its types, so it must stay
// free of `lib/supabase/server`. The server action (lib/actions/cadencia.ts)
// fetches the rows and calls `buildCadencia`.
//
// MODEL (decided with Nathan): cadence is measured as configured-cadence (the
// META, from `clients.posting_days`) vs Metricool reality (what actually went
// live). The production calendar is NOT the source of truth here — it's the
// status nobody maintains. So:
//   • META       = the weekdays the client is configured to post (posting_days).
//   • PUBLICADO   = Metricool reports the post PUBLISHED on that date.
//   • ATRASADO    = an expected day already passed with no published post, OR
//                   Metricool reported ERROR (failed to publish).
//   • PENDIENTE   = an expected day still upcoming (or today, time not yet due).
// Clients with no posting_days ("sin meta") still show their Metricool output in
// the drilldown, but don't move the rings.

import type { SocialPlatform } from '@/lib/supabase/types'

export type CadenciaStatus = 'publicado' | 'pendiente' | 'atrasado'

/**
 * Per-client weekly input. `publishedDates`/`errorDates`/`pendingDates` are
 * YYYY-MM-DD strings (one entry per Metricool post on that date, so duplicates
 * are meaningful — two published posts on the same day appear twice).
 */
export interface CadenciaClientInput {
  clientId: string
  clientName: string
  platforms: SocialPlatform[]
  postingTime: string | null // "HH:MM" local, or null
  postingDays: number[] // getDay() indices (0=Sun..6=Sat) the client is configured to post
  publishedDates: string[]
  errorDates: string[]
  pendingDates: string[]
  liveUrlsByDate: Record<string, string[]> // permalinks to confirmed-live posts, keyed by date
}

/**
 * Confirmation that a post is actually live on the social profile, derived from
 * Metricool's per-provider status (not scraping). `confirmed` = every target
 * network reported PUBLISHED; `failed` = at least one ERROR; `pending` = sent
 * but not yet confirmed live everywhere.
 */
export interface PostConfirmation {
  state: 'confirmed' | 'failed' | 'pending'
  url?: string // permalink to the live post (publicUrl from Metricool)
}

interface ConfirmablePost {
  id: number
  draft?: boolean
  providers: { status: string; publicUrl?: string }[]
}

/** Map one Metricool post to a confirmation, or null if it shouldn't count yet. */
export function buildConfirmation(post: ConfirmablePost): PostConfirmation | null {
  if (post.draft) return null
  const providers = post.providers ?? []
  if (providers.length === 0) return null
  if (providers.some((p) => p.status === 'ERROR')) return { state: 'failed' }
  if (providers.every((p) => p.status === 'PUBLISHED')) {
    const url = providers.find((p) => p.publicUrl)?.publicUrl
    return url ? { state: 'confirmed', url } : { state: 'confirmed' }
  }
  return { state: 'pending' }
}

/** Build a postId → confirmation map from a batch of Metricool posts. */
export function confirmationMapFromPosts(posts: ConfirmablePost[]): Record<number, PostConfirmation> {
  const map: Record<number, PostConfirmation> = {}
  for (const p of posts) {
    const c = buildConfirmation(p)
    if (c) map[p.id] = c
  }
  return map
}

export interface RingStats {
  published: number
  planned: number
  pending: number
  overdue: number
}

export interface CadenciaClientRow {
  clientId: string
  clientName: string
  platforms: SocialPlatform[]
  postingTime: string | null
  dots: CadenciaStatus[] // one per post/slot for the day, in stable order
  published: number // Metricool posts published that day (raw count, incl. bonus)
  planned: number // 1 if the day is an expected (meta) day, else 0
  hasOverdue: boolean
  // Live-confirmation overlay (from Metricool)
  confirmedCount: number // posts confirmed live on the profile that day
  failedCount: number // posts Metricool reported as failed that day
  liveUrls: string[] // permalinks to confirmed-live posts (client-level)
}

export interface CadenciaDay {
  date: string // YYYY-MM-DD
  /** Monday-based index 0..6 */
  index: number
  shortLabel: string // Lun, Mar, …
  fullLabel: string // Lunes, Martes, …
  planned: number
  published: number
  hasOverdue: boolean
  isToday: boolean
  isFuture: boolean
}

export interface CadenciaData {
  today: RingStats
  week: RingStats
  days: CadenciaDay[]
  byDay: Record<string, CadenciaClientRow[]>
  todayDate: string
}

const SHORT_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const FULL_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

/** Monday-based weekday index (0 = Monday) for a YYYY-MM-DD date string. */
export function mondayIndex(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  const day = new Date(y, m - 1, d).getDay() // 0 = Sunday
  return (day + 6) % 7
}

/** getDay() weekday (0=Sun..6=Sat) for a YYYY-MM-DD string — matches posting_days. */
export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

/** Parse "HH:MM" into minutes since midnight, or null if absent/invalid. */
export function postingTimeToMinutes(time: string | null): number | null {
  if (!time) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(time)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

function emptyStats(): RingStats {
  return { published: 0, planned: 0, pending: 0, overdue: 0 }
}

function countOn(dates: string[], date: string): number {
  let n = 0
  for (const d of dates) if (d === date) n++
  return n
}

/** Has the slot for `date` already passed, relative to today/now? */
function isPast(date: string, today: string, postingTime: string | null, nowMinutes: number): boolean {
  if (date < today) return true
  if (date === today) {
    const slot = postingTimeToMinutes(postingTime)
    if (slot !== null && nowMinutes > slot) return true
  }
  return false
}

interface Cell {
  dots: CadenciaStatus[]
  published: number // raw Metricool published count that day
  failed: number
  expected: boolean
  fulfilled: boolean // expected AND at least one published
  // ring contribution (only expected days count toward adherence)
  ringStatus: CadenciaStatus | null
}

/** Classify one (client, date) cell. */
function classifyCell(c: CadenciaClientInput, date: string, today: string, nowMinutes: number): Cell {
  const pub = countOn(c.publishedDates, date)
  const err = countOn(c.errorDates, date)
  const pend = countOn(c.pendingDates, date)
  const expected = c.postingDays.includes(weekdayOf(date))
  const past = isPast(date, today, c.postingTime, nowMinutes)

  const dots: CadenciaStatus[] = []
  for (let i = 0; i < pub; i++) dots.push('publicado')

  if (pub === 0) {
    if (expected) {
      dots.push(err > 0 || past ? 'atrasado' : 'pendiente')
    } else if (err > 0) {
      dots.push('atrasado')
    } else if (pend > 0) {
      dots.push('pendiente')
    }
  }

  // Ring adherence is measured only on expected (meta) days.
  let ringStatus: CadenciaStatus | null = null
  if (expected) {
    if (pub > 0) ringStatus = 'publicado'
    else if (err > 0 || past) ringStatus = 'atrasado'
    else ringStatus = 'pendiente'
  }

  return { dots, published: pub, failed: err, expected, fulfilled: expected && pub > 0, ringStatus }
}

function accumulate(stats: RingStats, status: CadenciaStatus): void {
  stats.planned += 1
  if (status === 'publicado') stats.published += 1
  else if (status === 'atrasado') stats.overdue += 1
  else stats.pending += 1
}

/**
 * Build the full widget model from this week's per-client Metricool data + meta.
 *
 * @param clients  per-client weekly inputs (any order)
 * @param weekDays 7 YYYY-MM-DD strings, Monday→Sunday
 * @param today    YYYY-MM-DD for "today"
 * @param nowMinutes minutes since midnight, for the overdue cutoff
 */
export function buildCadencia(
  clients: CadenciaClientInput[],
  weekDays: string[],
  today: string,
  nowMinutes: number,
): CadenciaData {
  const todayStats = emptyStats()
  const weekStats = emptyStats()
  const byDay: Record<string, CadenciaClientRow[]> = {}
  for (const date of weekDays) byDay[date] = []

  // Stable ordering: sort by client name then id so dots/rows are deterministic.
  const sorted = [...clients].sort(
    (a, b) => a.clientName.localeCompare(b.clientName) || a.clientId.localeCompare(b.clientId),
  )

  for (const c of sorted) {
    for (const date of weekDays) {
      const cell = classifyCell(c, date, today, nowMinutes)

      // Ring accounting (expected/meta days only).
      if (cell.ringStatus) {
        accumulate(weekStats, cell.ringStatus)
        if (date === today) accumulate(todayStats, cell.ringStatus)
      }

      // Drilldown row: show any day with posts (published/error/pending) or an
      // expected slot. Skip silent non-expected empty days.
      if (cell.dots.length === 0) continue

      byDay[date].push({
        clientId: c.clientId,
        clientName: c.clientName,
        platforms: c.platforms ?? [],
        postingTime: c.postingTime,
        dots: cell.dots,
        published: cell.published,
        planned: cell.expected ? 1 : 0,
        hasOverdue: cell.dots.includes('atrasado'),
        confirmedCount: cell.published,
        failedCount: cell.failed,
        liveUrls: c.liveUrlsByDate?.[date] ?? [], // only this day's confirmed-live posts
      })
    }
  }

  const days: CadenciaDay[] = weekDays.map((date) => {
    const rows = byDay[date]
    const planned = rows.reduce((s, r) => s + r.planned, 0)
    const published = rows.reduce((s, r) => s + (r.published > 0 ? 1 : 0), 0)
    const hasOverdue = rows.some((r) => r.hasOverdue)
    const idx = mondayIndex(date)
    return {
      date,
      index: idx,
      shortLabel: SHORT_LABELS[idx],
      fullLabel: FULL_LABELS[idx],
      planned,
      published,
      hasOverdue,
      isToday: date === today,
      isFuture: date > today,
    }
  })

  return { today: todayStats, week: weekStats, days, byDay, todayDate: today }
}

/** 7 YYYY-MM-DD strings Monday→Sunday for the week containing `ref`. */
export function weekDaysMon(ref: Date): string[] {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  const offset = (d.getDay() + 6) % 7
  const monday = new Date(d)
  monday.setDate(d.getDate() - offset)
  const fmt = (x: Date) => {
    const y = x.getFullYear()
    const m = String(x.getMonth() + 1).padStart(2, '0')
    const day = String(x.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(monday)
    x.setDate(monday.getDate() + i)
    return fmt(x)
  })
}

export function percent(published: number, planned: number): number {
  if (planned <= 0) return 0
  return Math.round((published / planned) * 100)
}
