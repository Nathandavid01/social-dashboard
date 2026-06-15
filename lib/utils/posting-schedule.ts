/**
 * Posting schedule resolution + done/missed status.
 *
 * Given a client's posting_days (0=Sun..6=Sat) plus a default posting_time and
 * optional per-day overrides (posting_schedule, keyed by day number as string),
 * we materialise the concrete (date + time) slots the client is EXPECTED to post
 * within a window, then compare each against the dates they actually posted to
 * decide whether the slot is done, still pending, or was missed.
 *
 * PURE — no server imports. The client-side schedule view imports this file, so
 * it must never transitively pull in lib/supabase/server. See CLAUDE.md.
 */

export type SlotStatus =
  | 'hecho' // a post went out on this date
  | 'pendiente' // expected today or in the future, not yet done
  | 'falto' // the date passed without a post

export interface ScheduleSlot {
  /** YYYY-MM-DD (local) */
  date: string
  /** 0=Sun..6=Sat */
  dayOfWeek: number
  /** HH:MM (24h) the client is expected to post, or null if no time configured */
  time: string | null
  status: SlotStatus
}

export interface ScheduleSummary {
  total: number
  hecho: number
  pendiente: number
  falto: number
}

/**
 * Resolve the expected posting time for a given weekday: a per-day override in
 * posting_schedule wins, otherwise the default posting_time, otherwise null.
 */
export function resolveSlotTime(
  dayOfWeek: number,
  postingTime: string | null | undefined,
  postingSchedule: Record<string, string> | null | undefined,
): string | null {
  const override = postingSchedule?.[String(dayOfWeek)]
  if (override && override.trim()) return override
  if (postingTime && postingTime.trim()) return postingTime
  return null
}

/** YYYY-MM-DD from a Date's LOCAL calendar fields (matches posting-cadence). */
function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface ComputeScheduleSlotsParams {
  postingDays: number[] | null | undefined
  postingTime?: string | null
  postingSchedule?: Record<string, string> | null
  /** Inclusive start of the window. */
  rangeStart: Date
  /** Inclusive end of the window. */
  rangeEnd: Date
  /** Local YYYY-MM-DD dates a post actually went out. */
  postedDates: Iterable<string>
  /** "Now" — decides pending vs. missed. */
  ref?: Date
}

export function computeScheduleSlots(params: ComputeScheduleSlotsParams): ScheduleSlot[] {
  const { postingDays, postingTime, postingSchedule, rangeStart, rangeEnd, postedDates } = params
  const ref = params.ref ?? rangeStart

  const days = new Set((postingDays ?? []).filter((d) => d >= 0 && d <= 6))
  if (days.size === 0) return []

  const posted = postedDates instanceof Set ? postedDates : new Set(postedDates)
  const todayIso = toLocalIsoDate(ref)

  const slots: ScheduleSlot[] = []
  const cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate())
  const end = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate())

  while (cur <= end) {
    const dow = cur.getDay()
    if (days.has(dow)) {
      const date = toLocalIsoDate(cur)
      let status: SlotStatus
      if (posted.has(date)) status = 'hecho'
      else if (date < todayIso) status = 'falto'
      else status = 'pendiente'
      slots.push({ date, dayOfWeek: dow, time: resolveSlotTime(dow, postingTime, postingSchedule), status })
    }
    cur.setDate(cur.getDate() + 1)
  }

  return slots
}

export function summarizeSlots(slots: ScheduleSlot[]): ScheduleSummary {
  const summary: ScheduleSummary = { total: slots.length, hecho: 0, pendiente: 0, falto: 0 }
  for (const s of slots) summary[s.status]++
  return summary
}

/** Minimal shapes for the two publish sources we union. */
export interface PostedIdeaRow {
  published_at?: string | null
}
export interface MetricoolPostLike {
  publicationDate?: { dateTime?: string | null } | null
  draft?: boolean
}

/**
 * Build the set of local YYYY-MM-DD dates a client actually posted, unioning
 * content_ideas.published_at with non-draft Metricool posts. We slice the date
 * portion of each timestamp (Metricool dateTime is local wall-clock; idea
 * stamps are app-set) — granularity is per-day, which is what the schedule
 * "did they post that day?" check needs.
 */
export function collectPostedDates(
  ideaRows: readonly PostedIdeaRow[] | null | undefined,
  metricoolPosts: readonly MetricoolPostLike[] | null | undefined,
): Set<string> {
  const dates = new Set<string>()
  for (const r of ideaRows ?? []) {
    const ts = r.published_at
    if (ts && ts.length >= 10) dates.add(ts.slice(0, 10))
  }
  for (const p of metricoolPosts ?? []) {
    if (p.draft) continue
    const dt = p.publicationDate?.dateTime
    if (dt && dt.length >= 10) dates.add(dt.slice(0, 10))
  }
  return dates
}

export const SLOT_STATUS_META: Record<SlotStatus, { label: string; badge: string; dot: string }> = {
  hecho: { label: 'Hecho', badge: 'bg-green-500/15 text-green-600', dot: 'bg-green-500' },
  pendiente: { label: 'Pendiente', badge: 'bg-blue-500/15 text-blue-600', dot: 'bg-blue-500' },
  falto: { label: 'Faltó', badge: 'bg-red-500/15 text-red-600', dot: 'bg-red-500' },
}
