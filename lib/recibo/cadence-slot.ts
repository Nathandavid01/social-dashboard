import { addDaysISO } from '@/lib/utils/deadlines'
import { spanishDateLabel } from '@/lib/utils/next-autopost-core'
import { automaticPublishSchedule } from '@/lib/utils/automatic-publish-schedule'
import { parseSlotTime, resolveSlotTime } from '@/lib/utils/posting-schedule'

export type CadenceSlot =
  | { ok: true; dateISO: string; time: string; label: string }
  | { ok: false; reason: 'sin-dias'; needsManual: true; dateISO?: string; label?: string }
  | { ok: false; reason: 'sin-hora'; needsManual: true; dateISO?: string; label?: string }
  | { ok: false; reason: 'pasado'; dateISO?: string; label?: string }

function clockLabel(time: string): { time: string; clock: string } | null {
  const parsed = parseSlotTime(time)
  if (!parsed) return null
  const [hourText, minuteText] = parsed.split(':')
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const hour12 = hour % 12 || 12
  return {
    time: parsed,
    clock: `${hour12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'a.m.' : 'p.m.'}`,
  }
}

function missingDays(dateISO?: string): Extract<CadenceSlot, { reason: 'sin-dias' }> {
  return dateISO
    ? { ok: false, reason: 'sin-dias', needsManual: true, dateISO, label: spanishDateLabel(dateISO) }
    : { ok: false, reason: 'sin-dias', needsManual: true }
}

function missingTime(dateISO?: string): Extract<CadenceSlot, { reason: 'sin-hora' }> {
  return dateISO
    ? { ok: false, reason: 'sin-hora', needsManual: true, dateISO, label: spanishDateLabel(dateISO) }
    : { ok: false, reason: 'sin-hora', needsManual: true }
}

/** Date + explicit HH:MM chosen on the Recibo card when cadence is incomplete. */
export function manualCadenceSlot(dateISO: string, time: string): CadenceSlot {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return missingDays()
  const clock = clockLabel(time)
  if (!clock) return missingTime(dateISO)
  return {
    ok: true,
    dateISO,
    time: clock.time,
    label: `${spanishDateLabel(dateISO)}, ${clock.clock}`,
  }
}

function weekdayOf(dateISO: string): number {
  const [year, month, day] = dateISO.split('-').map(Number)
  return new Date(year, month - 1, day, 12).getDay()
}

export function cadenceSlotForDate(input: {
  dateISO: string
  postingTime?: string | null
  postingSchedule?: Record<string, string> | null
}): CadenceSlot {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateISO)) return missingDays()
  const time = resolveSlotTime(weekdayOf(input.dateISO), input.postingTime, input.postingSchedule)
  if (!time) return missingTime(input.dateISO)
  const clock = clockLabel(time)
  if (!clock) return missingTime(input.dateISO)
  return {
    ok: true,
    dateISO: input.dateISO,
    time: clock.time,
    label: `${spanishDateLabel(input.dateISO)}, ${clock.clock}`,
  }
}

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
  if (days.size === 0) return missingDays()

  const windowDays = input.windowDays ?? 21
  for (let offset = 0; offset <= windowDays; offset++) {
    const dateISO = addDaysISO(input.todayISO, offset)
    const weekday = weekdayOf(dateISO)
    if (!days.has(weekday)) continue
    return cadenceSlotForDate({
      dateISO,
      postingTime: input.postingTime,
      postingSchedule: input.postingSchedule,
    })
  }
  return missingDays()
}

/**
 * Date Recibo should send to Metricool. Uses the space date when it exists.
 * Does not invent a replacement if that date already passed.
 */
export function reciboScheduleTarget(input: {
  spaceDateISO?: string | null
  postingDays?: number[] | null
  postingTime?: string | null
  postingSchedule?: Record<string, string> | null
  todayISO: string
  nowMs?: number
}): CadenceSlot {
  const space = input.spaceDateISO?.trim() || null
  if (!space) {
    return nextCadenceSlot({
      postingDays: input.postingDays,
      postingTime: input.postingTime,
      postingSchedule: input.postingSchedule,
      todayISO: input.todayISO,
    })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(space)) return missingDays()
  if (space < input.todayISO) {
    const label = spanishDateLabel(space)
    return { ok: false, reason: 'pasado', dateISO: space, label }
  }
  const slot = cadenceSlotForDate({
    dateISO: space,
    postingTime: input.postingTime,
    postingSchedule: input.postingSchedule,
  })
  if (!slot.ok) return slot
  if (space === input.todayISO) {
    const check = automaticPublishSchedule(space, slot.time, input.nowMs ?? Date.now())
    if (!check.ok) {
      return { ok: false, reason: 'pasado', dateISO: space, label: slot.label }
    }
  }
  return slot
}
