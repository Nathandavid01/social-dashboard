/**
 * Pure helpers for period-over-period comparison in reports.
 */

/** Percent change current vs previous. null when previous is 0/undefined. */
export function deltaPct(current: number, previous: number | null | undefined): number | null {
  if (previous == null || previous <= 0) return null
  return ((current - previous) / previous) * 100
}

export type DeltaTone = 'up' | 'down' | 'flat' | 'none'

export function deltaTone(d: number | null): DeltaTone {
  if (d == null) return 'none'
  if (d > 0.5) return 'up'
  if (d < -0.5) return 'down'
  return 'flat'
}

export function formatDelta(d: number | null): string {
  if (d == null) return '—'
  const r = Math.round(d)
  return `${r > 0 ? '+' : ''}${r}%`
}

/** Shift a [start,end] window back by its own length, for the previous period. */
export function previousWindow(days: number, now: number): { start: number; end: number } {
  const ms = days * 24 * 60 * 60 * 1000
  return { start: now - 2 * ms, end: now - ms }
}
