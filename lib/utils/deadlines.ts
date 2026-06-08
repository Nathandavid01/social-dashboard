/**
 * Pure helpers for per-video DEADLINES (fecha límite) on content_ideas.
 *
 * All date math is done on date-only "YYYY-MM-DD" strings compared
 * lexicographically — NEVER via `Date.toISOString()` (which is UTC and shifts
 * the calendar day for users west of UTC at night). This mirrors how the app
 * already renders `publish_date` / `recording_date` as local calendar days.
 *
 * Kept free of any Supabase import so it's unit-testable in isolation.
 */

export type DeadlineStatus = 'none' | 'overdue' | 'due-soon' | 'future'

/** Today's date as a local-calendar "YYYY-MM-DD" (no UTC conversion). */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Add `days` to a "YYYY-MM-DD" string, returning a "YYYY-MM-DD" string. */
export function addDaysISO(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return todayISO(new Date(y, m - 1, d + days))
}

/** How urgent a video's deadline is, relative to `today`. Days-soon window = 2. */
export function deadlineStatus(
  deadline: string | null | undefined,
  status: string | null | undefined,
  today: string = todayISO(),
  publishedAt?: string | null,
): DeadlineStatus {
  // Once published there's nothing left to be late for. The app considers a video
  // published when EITHER published_at is set OR status === 'publicada' (the
  // auto-post path may set published_at without flipping status) — honor both.
  if (!deadline || status === 'publicada' || publishedAt) return 'none'
  if (deadline < today) return 'overdue'
  if (deadline <= addDaysISO(today, 2)) return 'due-soon'
  return 'future'
}

/** Urgency ordering — higher wins when rolling many videos into one badge. */
const RANK: Record<DeadlineStatus, number> = { none: 0, future: 1, 'due-soon': 2, overdue: 3 }

/**
 * The most-urgent deadline status across a set of videos (for a batch-level
 * badge). Each video is evaluated with `deadlineStatus` (so published ones are
 * ignored). Returns 'none' for an empty/all-clear set.
 */
export function worstDeadlineStatus(
  videos: { deadline?: string | null; status?: string | null; published_at?: string | null }[],
  today: string = todayISO(),
): DeadlineStatus {
  let worst: DeadlineStatus = 'none'
  for (const v of videos) {
    const s = deadlineStatus(v.deadline, v.status, today, v.published_at)
    if (RANK[s] > RANK[worst]) worst = s
  }
  return worst
}

/** Spanish label + Tailwind tone classes for a deadline status (badge styling). */
export function deadlineTone(s: DeadlineStatus): { className: string; label: string | null } {
  switch (s) {
    case 'overdue':
      return { className: 'bg-red-500/12 text-red-400 border-red-500/30', label: 'Atrasado' }
    case 'due-soon':
      return { className: 'bg-amber-500/12 text-amber-400 border-amber-500/30', label: 'Pronto' }
    default:
      return { className: 'bg-muted text-muted-foreground border-transparent', label: null }
  }
}
