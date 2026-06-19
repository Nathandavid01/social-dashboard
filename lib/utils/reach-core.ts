/**
 * Pure helpers to total "personas alcanzadas" (reach) from Metricool post
 * stats. No network here so it's unit-testable; the server action feeds it the
 * raw /stats/posts arrays.
 */

export interface ReachPost {
  reach?: number | null
  impressions?: number | null
  plays?: number | null
}

/**
 * Reach for a single post. Prefer real reach; fall back to impressions, then
 * plays (some networks only report one of them). Never negative.
 */
export function postReach(p: ReachPost): number {
  const v = p.reach ?? p.impressions ?? p.plays ?? 0
  return Number.isFinite(v) && v > 0 ? Math.floor(v as number) : 0
}

/** Sum reach across a /stats/posts array. Tolerant of non-array / junk input. */
export function sumPostReach(posts: unknown): number {
  if (!Array.isArray(posts)) return 0
  return posts.reduce<number>(
    (acc, p) => acc + (p && typeof p === 'object' ? postReach(p as ReachPost) : 0),
    0,
  )
}
