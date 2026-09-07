import { automaticPublishSchedule } from './automatic-publish-schedule'

const DAY_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTH_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export interface PublishSchedule {
  /** Naive local datetime handed to Metricool, e.g. "2026-07-30T14:30:00". */
  iso: string
  /** Human label, e.g. "Jue 30 jul 2026 · 14:30". */
  label: string
  /** An invalid schedule requires an explicit date change before sending. */
  blockedReason?: string
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
  const result = automaticPublishSchedule(publishDate, postingTime, nowMs)
  if (!result.ok) return { iso: '', label: 'Fecha pendiente de corregir', blockedReason: result.error }
  return { iso: result.iso, label: formatScheduleLabel(result.iso) }
}
