/**
 * Planned recording sessions for a client, as VISUAL empty slots on the board.
 *
 * A client's monthly video target (derived from posting cadence) is split into
 * recording sessions of `perWeek × recording_interval_weeks` videos each. Each
 * session becomes one card on the board with that many slots; slots not yet
 * backed by a real content_idea are "empty" — waiting for the idea to be made.
 *
 * Pure + dependency-free so it can be unit-tested without a DB. No rows are
 * created; this only computes how many cards/slots to draw.
 */

export interface PlannedSession {
  index: number
  label: string
  /** Total video slots in this session. */
  total: number
  /** Slots already backed by a real idea. */
  filled: number
  /** Slots still waiting for an idea to be made. */
  empty: number
}

/**
 * The next `count` posting dates for a client, from `from` (inclusive), based on
 * their posting_days (0=Sun..6=Sat). Used to label each empty video slot with the
 * day it will be posted. Pure: pass `from` so it's testable. ISO 'YYYY-MM-DD'.
 */
export function nextPostingDates(postingDays: number[], count: number, from: Date): string[] {
  const days = new Set((postingDays ?? []).filter((d) => d >= 0 && d <= 6))
  const n = Math.max(0, Math.floor(count))
  if (days.size === 0 || n === 0) return []
  const out: string[] = []
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  let guard = 0
  while (out.length < n && guard < 800) {
    if (days.has(d.getDay())) out.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
    guard++
  }
  return out
}

export interface PlannedSlot {
  index: number
  /** ISO 'YYYY-MM-DD' posting date for this slot. */
  date: string
}

/** Build the empty video slots for a client's current session, dated by cadence. */
export function planSlots(postingDays: number[], count: number, from: Date): PlannedSlot[] {
  return nextPostingDates(postingDays, count, from).map((date, index) => ({ index, date }))
}

/**
 * Whether to draw planned empty-slot cards for a client on the board.
 *
 * Only active clients with a posting cadence that haven't started yet (no active
 * ideas) get planned cards — clients already being worked keep their real batch
 * card (which preserves their pipeline progress), so nothing appears twice.
 */
export function shouldPlanForClient(opts: {
  status: string
  postingDaysLength: number
  activeIdeasCount: number
}): boolean {
  return opts.status === 'active' && opts.postingDaysLength > 0 && opts.activeIdeasCount === 0
}

export interface PlanSessionsInput {
  /** Videos needed this month (from posting cadence, e.g. perMonth). */
  monthlyTarget: number
  /** Posting days per week (cadence). */
  perWeek: number
  /** Weeks of content recorded per session (recording_interval_weeks). */
  intervalWeeks: number
  /** How many real content_ideas already exist for the client. */
  ideasCount: number
}

/**
 * Split the month into recording sessions with filled/empty slot counts.
 *
 * Uses round() (not ceil) for the session count so a daily client (~30/month)
 * with a 2-week interval (~14/session) shows 2 even cards of 15 — matching how
 * the team thinks about it ("grabar 2 veces al mes → 2 tarjetas de 15").
 */
export function planSessions({
  monthlyTarget,
  perWeek,
  intervalWeeks,
  ideasCount,
}: PlanSessionsInput): PlannedSession[] {
  const month = Math.max(0, Math.floor(monthlyTarget))
  const week = Math.max(0, Math.floor(perWeek))
  if (month <= 0 || week <= 0) return []

  const sessionSize = Math.max(1, week * Math.max(1, Math.floor(intervalWeeks)))
  const numSessions = Math.max(1, Math.round(month / sessionSize))

  // Distribute the month's slots as evenly as possible across sessions.
  const base = Math.floor(month / numSessions)
  const remainder = month % numSessions

  let remainingIdeas = Math.max(0, Math.floor(ideasCount))
  const sessions: PlannedSession[] = []
  for (let i = 0; i < numSessions; i++) {
    const total = base + (i < remainder ? 1 : 0)
    const filled = Math.min(total, remainingIdeas)
    remainingIdeas -= filled
    sessions.push({
      index: i,
      label: `Sesión ${i + 1}`,
      total,
      filled,
      empty: total - filled,
    })
  }
  return sessions
}
