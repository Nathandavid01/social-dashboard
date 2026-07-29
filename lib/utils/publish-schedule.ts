import { buildPublishDateTime } from '@/lib/utils/idea-posting-core'

/**
 * The date/time a video will ACTUALLY be sent to Metricool, with its weekday.
 *
 * Not the same as the planned publish_date: buildPublishDateTime clamps a past
 * or missing date to +24h so an overdue approval can't auto-publish on the
 * spot. Showing the planned date on the card would then be a lie, so `clamped`
 * says when that happened and the label reflects the real schedule.
 */

const DAY_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTH_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export interface PublishSchedule {
  /** Naive local datetime handed to Metricool, e.g. "2026-07-30T14:30:00". */
  iso: string
  /** Human label, e.g. "Jue 30 jul 2026 · 14:30". */
  label: string
  /** True when the planned date was missing or past and got pushed to +24h. */
  clamped: boolean
}

/**
 * Label for a naive "YYYY-MM-DDTHH:MM[:SS]", e.g. "Jue 30 jul 2026 · 14:30".
 * Shared so a hand-picked time on the Publicación card reads identically to the
 * planned one.
 */
export function formatScheduleLabel(iso: string): string {
  const [datePart, timePart] = iso.split('T')
  const [y, m, d] = datePart.split('-').map(Number)
  const time = timePart?.slice(0, 5) ?? '10:00'
  // Local midnight of that calendar day — only the weekday is read off it.
  const weekday = DAY_ES[new Date(y, m - 1, d).getDay()]
  return `${weekday} ${d} ${MONTH_ES[m - 1]} ${y} · ${time}`
}

export function publishSchedule(
  publishDate: string | null | undefined,
  postingTime: string | null | undefined,
  nowMs: number = Date.now(),
): PublishSchedule {
  const iso = buildPublishDateTime(publishDate, postingTime, nowMs)
  const todayUtc = new Date(nowMs).toISOString().slice(0, 10)
  const clamped = !publishDate || publishDate < todayUtc

  return { iso, clamped, label: formatScheduleLabel(iso) }
}
