import type { ProductionContentType } from '@/lib/supabase/types'

/**
 * Pure helpers for editing a client's weekly production cadence — the days a
 * client should post and the TYPE each day (R = Reel, P = Post). Kept free of
 * Supabase/React so the toggle logic is unit-testable. day_of_week: 1=Mon..7=Sun.
 */
export type DayCadence = ProductionContentType | null

/** Click cycle for a day cell: empty → R → P → empty. */
export function cycleCadence(t: DayCadence): DayCadence {
  return t === null ? 'R' : t === 'R' ? 'P' : null
}

/** Build a day→type map (days 1..7) from stored schedule rows. First type per day wins. */
export function schedulesToDayMap(
  schedules: { day_of_week: number; content_type: ProductionContentType }[],
): Record<number, ProductionContentType> {
  const map: Record<number, ProductionContentType> = {}
  for (const s of schedules) {
    if (!(s.day_of_week in map)) map[s.day_of_week] = s.content_type
  }
  return map
}

/** Convert an editable day→type map back to schedule rows (skips empty days), ordered Mon→Sun. */
export function dayMapToSchedules(
  map: Record<number, DayCadence>,
): { day_of_week: number; content_type: ProductionContentType }[] {
  const out: { day_of_week: number; content_type: ProductionContentType }[] = []
  for (let d = 1; d <= 7; d++) {
    const t = map[d]
    if (t) out.push({ day_of_week: d, content_type: t })
  }
  return out
}

/** Weekly totals for a cadence map. */
export function countCadence(map: Record<number, DayCadence>): { total: number; reels: number; posts: number } {
  let reels = 0
  let posts = 0
  for (let d = 1; d <= 7; d++) {
    if (map[d] === 'R') reels++
    else if (map[d] === 'P') posts++
  }
  return { total: reels + posts, reels, posts }
}
