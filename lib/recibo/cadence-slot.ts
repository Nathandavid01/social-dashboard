import { addDaysISO } from '@/lib/utils/deadlines'
import { spanishDateLabel } from '@/lib/utils/next-autopost-core'
import { resolveSlotTime } from '@/lib/utils/posting-schedule'

export type CadenceSlot =
  | { ok: true; dateISO: string; time: string; label: string }
  | { ok: false; reason: 'sin-dias' | 'sin-hora' }

/**
 * Next posting moment from the client's cadence, on or after today.
 * posting_days uses 0=Sunday … 6=Saturday. No days, or a day without an hour,
 * is a reason the card can say out loud.
 */
export function nextCadenceSlot(input: {
  postingDays?: number[] | null
  postingTime?: string | null
  postingSchedule?: Record<string, string> | null
  todayISO: string
  windowDays?: number
}): CadenceSlot {
  const days = new Set((input.postingDays ?? []).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))
  if (days.size === 0) return { ok: false, reason: 'sin-dias' }

  const windowDays = input.windowDays ?? 21
  for (let offset = 0; offset <= windowDays; offset++) {
    const dateISO = addDaysISO(input.todayISO, offset)
    const [year, month, day] = dateISO.split('-').map(Number)
    const weekday = new Date(year, month - 1, day).getDay()
    if (!days.has(weekday)) continue
    const time = resolveSlotTime(weekday, input.postingTime, input.postingSchedule)
    if (!time) return { ok: false, reason: 'sin-hora' }
    const [hourText, minuteText] = time.split(':')
    const hour = Number(hourText)
    const minute = Number(minuteText)
    const hour12 = hour % 12 || 12
    const clock = `${hour12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'a.m.' : 'p.m.'}`
    return {
      ok: true,
      dateISO,
      time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      label: `${spanishDateLabel(dateISO)}, ${clock}`,
    }
  }
  return { ok: false, reason: 'sin-dias' }
}
