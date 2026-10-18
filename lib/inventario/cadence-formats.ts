/**
 * Which format a client publishes on each posting day — reel, post or story —
 * so a ready reel is not counted as covering a post day.
 *
 * Sources, in order:
 *   1. clients.posting_schedule — per-day override from the client calendar
 *      (JS weekday keys "0".."6"; values "reel" | "post" | "story" or a time).
 *   2. production_schedules — ISO weekday (1=Mon..7=Sun) + content_type R/P.
 *   3. Unknown → null (either format fills it).
 */
export type Format = 'reel' | 'post' | 'story'

export interface ProductionScheduleRow {
  /** ISO 1=Mon..7=Sun (migration 0005). */
  day_of_week: number
  content_type: string | null
}

export function ideaFormat(contentType: string | null | undefined): Format {
  switch ((contentType ?? '').toUpperCase()) {
    case 'P':
    case 'C':
      return 'post'
    case 'S':
      return 'story'
    default:
      return 'reel'
  }
}

function scheduleFormat(value: string | undefined): Format | null {
  const v = value?.trim().toLowerCase()
  return v === 'reel' || v === 'post' || v === 'story' ? v : null
}

export function cadenceFormats(
  postingDays: number[] | null | undefined,
  postingSchedule: Record<string, string> | null | undefined,
  productionSchedules: ProductionScheduleRow[] | null | undefined,
): Map<number, Format | null> {
  const fromProduction = new Map<number, Set<Format>>()
  for (const row of productionSchedules ?? []) {
    if (!Number.isInteger(row.day_of_week) || row.day_of_week < 1 || row.day_of_week > 7) continue
    const js = row.day_of_week % 7 // ISO 7 (Sun) → JS 0
    const set = fromProduction.get(js) ?? new Set<Format>()
    set.add(ideaFormat(row.content_type))
    fromProduction.set(js, set)
  }

  const out = new Map<number, Format | null>()
  for (const day of new Set(postingDays ?? [])) {
    if (!Number.isInteger(day) || day < 0 || day > 6) continue
    const explicit = scheduleFormat(postingSchedule?.[String(day)])
    if (explicit) {
      out.set(day, explicit)
      continue
    }
    const booked = fromProduction.get(day)
    out.set(day, booked && booked.size === 1 ? [...booked][0] : null)
  }
  return out
}
