import { nextPostingDates, formatPlannedPublishLabel } from '@/lib/utils/planned-sessions'
import { addDaysISO } from '@/lib/utils/deadlines'
import { esVivo } from '@/lib/clients/estado'

/**
 * Pure planner for the weekly auto-created cards: for every active client with
 * a posting cadence, materialize one content_idea per cadence date in the
 * coming window — so the card "opens by itself" on the team's board and they
 * only fill in the video, caption and title.
 *
 * Two guards make it safe to run daily against real production data:
 *
 * 1. EXACT-DATE BLOCK — a date that already has ANY idea for that client
 *    (including a discarded one: the team said no) is never re-created.
 * 2. IN-FLIGHT ACCOUNTING — every unpublished active idea the client already
 *    has (dated or not) consumes one upcoming slot, so a client with a full
 *    plate gets NO new cards until work ships. This mirrors how the product
 *    already thinks (findNextNewVideoSlot: a new video takes slot[activeCount])
 *    and keeps auto-cards from spamming worked clients, dragging their batch
 *    card back to the Video column, or accumulating without bound.
 *
 * Deliberately conservative: dated in-window ideas both block their date AND
 * count as in-flight, so if anything we create FEWER cards, never more.
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

export function planWeekInserts(
  clients: PlanWeekClient[],
  existing: PlanWeekExistingIdea[],
  /** Per-client count of active, unpublished ideas (the in-flight plate). */
  inFlightByClient: Record<string, number>,
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
    if (!esVivo(c.status)) continue
    const days = c.posting_days ?? []
    if (days.length === 0) continue
    // At most one slot per day → daysAhead+1 dates cover the whole window.
    const openSlots = nextPostingDates(days, daysAhead + 1, from)
      .filter((date) => date <= endISO)
      .filter((date) => !taken.has(`${c.id}|${date}`))
    // The in-flight plate consumes the earliest open slots — only the surplus
    // becomes new cards. A busy client creates nothing until work ships.
    const inFlight = Math.max(0, inFlightByClient[c.id] ?? 0)
    for (const date of openSlots.slice(inFlight)) {
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
