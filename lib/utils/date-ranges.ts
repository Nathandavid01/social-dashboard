import { todayISO } from './deadlines'

export type DateRange = 'all' | 'month' | 'week'

/**
 * The inclusive lower bound (a local-calendar "YYYY-MM-DD") for a named range,
 * or null for "all" (no bound). Weeks start on Monday. Used to scope the
 * per-user upload metrics ("esta semana" / "este mes" / "todo").
 */
export function startOfRangeISO(range: DateRange, now: Date = new Date()): string | null {
  if (range === 'all') return null
  if (range === 'month') return todayISO(new Date(now.getFullYear(), now.getMonth(), 1))
  // week → Monday of the current week
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day = d.getDay() // 0=Sun..6=Sat
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return todayISO(d)
}
