import { nextPostingDates, formatPlannedPublishLabel } from '@/lib/utils/planned-sessions'

/**
 * Pure planner for the weekly auto-created cards: for every active client with
 * a posting cadence, materialize one content_idea per cadence date in the
 * coming window — so the card "opens by itself" on the team's board and they
 * only fill in the video, caption and title.
 *
 * Idempotent by design: a date that already has ANY idea for that client
 * (including a discarded one — the team said no) is never re-created.
 * Dependency-free so the cron logic is fully unit-testable.
 */

export interface PlanWeekClient {
  id: string
  name: string
  status: string
  /** JS weekday convention 0=Sun..6=Sat (clients.posting_days). */
  posting_days: number[] | null
}

export interface PlanWeekExistingIdea {
  client_id: string
  publish_date: string | null
}

export interface PlanWeekInsert {
  client_id: string
  publish_date: string
  title: string
  content_type: 'R'
  status: 'idea'
}

/** ISO date `days` after `iso` (date-only math, no TZ shift). */
function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${mm}-${dd}`
}

export function planWeekInserts(
  clients: PlanWeekClient[],
  existing: PlanWeekExistingIdea[],
  todayISO: string,
  daysAhead = 7,
): PlanWeekInsert[] {
  const endISO = addDaysISO(todayISO, daysAhead)
  const taken = new Set(
    existing.filter((e) => e.publish_date).map((e) => `${e.client_id}|${e.publish_date}`),
  )

  const [y, m, d] = todayISO.split('-').map(Number)
  const from = new Date(y, m - 1, d)

  const out: PlanWeekInsert[] = []
  for (const c of clients) {
    if (c.status !== 'active') continue
    const days = c.posting_days ?? []
    if (days.length === 0) continue
    // At most one slot per day → daysAhead+1 dates cover the whole window.
    const dates = nextPostingDates(days, daysAhead + 1, from).filter((date) => date <= endISO)
    for (const date of dates) {
      if (taken.has(`${c.id}|${date}`)) continue
      out.push({
        client_id: c.id,
        publish_date: date,
        title: `${c.name} · ${formatPlannedPublishLabel(date).toLowerCase()}`,
        content_type: 'R',
        status: 'idea',
      })
    }
  }
  return out
}
