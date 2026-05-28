/**
 * Posting cadence math.
 * Given a client's posting_days (0=Sun..6=Sat), compute how many posts
 * they SHOULD have this week (Mon→Sun) and this month, plus how many
 * are still upcoming from "now".
 */

export interface PostingTargets {
  perWeek: number
  perMonth: number
  thisWeekRemaining: number
  thisMonthRemaining: number
  /** ISO date strings for the upcoming posting days within this month */
  upcomingDates: string[]
}

function startOfWeekMon(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  // JS: 0=Sun..6=Sat → shift to Mon=0
  const day = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - day)
  return x
}

function endOfWeekMon(d: Date): Date {
  const start = startOfWeekMon(d)
  start.setDate(start.getDate() + 6)
  start.setHours(23, 59, 59, 999)
  return start
}

function eachDay(start: Date, end: Date): Date[] {
  const out: Date[] = []
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  while (cur <= end) {
    out.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

export function computePostingTargets(
  postingDays: number[] | null | undefined,
  ref: Date = new Date(),
): PostingTargets {
  const days = Array.from(new Set((postingDays ?? []).filter((d) => d >= 0 && d <= 6)))
  if (days.length === 0) {
    return { perWeek: 0, perMonth: 0, thisWeekRemaining: 0, thisMonthRemaining: 0, upcomingDates: [] }
  }

  const perWeek = days.length

  // This week's range (Mon→Sun)
  const weekStart = startOfWeekMon(ref)
  const weekEnd = endOfWeekMon(ref)
  const weekDates = eachDay(weekStart, weekEnd)

  // This month's range
  const monthStart = new Date(ref.getFullYear(), ref.getMonth(), 1)
  const monthEnd = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999)
  const monthDates = eachDay(monthStart, monthEnd)

  const perMonth = monthDates.filter((d) => days.includes(d.getDay())).length

  const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  const thisWeekRemaining = weekDates.filter((d) => days.includes(d.getDay()) && d >= today).length
  const upcomingDates = monthDates
    .filter((d) => days.includes(d.getDay()) && d >= today)
    .map((d) => d.toISOString().slice(0, 10))
  const thisMonthRemaining = upcomingDates.length

  return { perWeek, perMonth, thisWeekRemaining, thisMonthRemaining, upcomingDates }
}

export const dayLabelsShort: Record<number, string> = {
  0: 'Dom',
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
  6: 'Sáb',
}

export const dayLabelsFull: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
}
