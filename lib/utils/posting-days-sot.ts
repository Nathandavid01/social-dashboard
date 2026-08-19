/**
 * Source of truth for "which days does this client post": `clients.posting_days`
 * (JS weekday, 0=Sun … 6=Sat), edited on the client profile chips.
 *
 * `production_schedules` may still store Reel vs Post per day, but it must not
 * invent a posting day the profile did not pick.
 */
import { addDaysISO } from './deadlines'
import { isoWeekday, type CadenceRow, type CadenceType } from './next-autopost-core'

export function jsWeekdayToIso(js: number): number {
  return js === 0 ? 7 : js
}

export function isoWeekdayToJs(iso: number): number {
  return iso === 7 ? 0 : iso
}

function cleanJsDays(days: number[] | null | undefined): number[] {
  return Array.from(new Set((days ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)))
}

/** Next free cadence calendar day on/after `fromISO`. */
export function claimNextPostingSlot(opts: {
  postingDays: number[] | null | undefined
  occupiedDates: string[]
  fromISO: string
  windowDays?: number
}): string | null {
  const days = new Set(cleanJsDays(opts.postingDays))
  if (days.size === 0) return null
  const taken = new Set(opts.occupiedDates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))
  const windowDays = opts.windowDays ?? 400
  for (let offset = 0; offset <= windowDays; offset++) {
    const dateISO = addDaysISO(opts.fromISO, offset)
    const js = isoWeekdayToJs(isoWeekday(dateISO))
    if (days.has(js) && !taken.has(dateISO)) return dateISO
  }
  return null
}

export function occupiedDatesFromSiblings(
  ideaId: string,
  rows: Array<{ id: string } & Parameters<typeof occupiesCadenceSlot>[0]>,
): string[] {
  const dates: string[] = []
  for (const row of rows) {
    if (row.id === ideaId) continue
    if (occupiesCadenceSlot(row) && row.publish_date) dates.push(row.publish_date)
  }
  return dates
}

export function occupiesCadenceSlot(v: {
  publish_date?: string | null
  approval_status?: string | null
  published_at?: string | null
  metricool_post_id?: number | null
  status?: string | null
}): boolean {
  if (!v.publish_date || !/^\d{4}-\d{2}-\d{2}$/.test(v.publish_date)) return false
  if (v.published_at || v.status === 'publicada' || v.metricool_post_id != null) return true
  return v.approval_status === 'approved'
}

export function schedulesAfterPostingDaysChange(
  existing: { day_of_week: number; content_type: CadenceType }[],
  postingDays: number[] | null | undefined,
): { day_of_week: number; content_type: CadenceType }[] {
  const isoKeep = cleanJsDays(postingDays).map(jsWeekdayToIso)
  const keepSet = new Set(isoKeep)
  const kept = existing.filter((s) => keepSet.has(s.day_of_week))
  const present = new Set(kept.map((s) => s.day_of_week))
  for (let i = 0; i < isoKeep.length; i++) {
    const iso = isoKeep[i]
    if (!present.has(iso)) {
      kept.push({ day_of_week: iso, content_type: 'R' })
      present.add(iso)
    }
  }
  return kept.sort((a, b) => a.day_of_week - b.day_of_week || (a.content_type === 'R' ? -1 : 1))
}

/** Days the rest of the app may treat as cadence — profile wins. */
export function cadenceRowsFromPostingDays(
  postingDays: number[] | null | undefined,
  schedules: CadenceRow[] = [],
): CadenceRow[] {
  const isoKeep = cleanJsDays(postingDays).map(jsWeekdayToIso)
  if (isoKeep.length === 0) return []
  const keepSet = new Set(isoKeep)
  const fromSched = schedules.filter((s) => keepSet.has(s.day_of_week))
  const have = new Set(fromSched.map((s) => s.day_of_week))
  const extras: CadenceRow[] = isoKeep
    .filter((d) => !have.has(d))
    .map((day_of_week) => ({ day_of_week, content_type: 'R' as CadenceType }))
  return [...fromSched, ...extras].sort(
    (a, b) => a.day_of_week - b.day_of_week || (a.content_type === 'R' ? -1 : 1),
  )
}

export function postingDaysFromIsoWeekdays(isoDays: number[]): number[] {
  return Array.from(new Set(isoDays.filter((d) => d >= 1 && d <= 7).map(isoWeekdayToJs))).sort((a, b) => a - b)
}
