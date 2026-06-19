/**
 * Pure helpers to read "personas alcanzadas" (reach) from Metricool's
 * /stats/aggregations/{network} response. Instagram exposes a clean `reach`;
 * Facebook only reports impressions (page_impressions_unique = true reach when
 * present). No network here so it's unit-testable.
 */

/** Keys that represent true unique reach, in preference order. */
export const REACH_KEYS = ['reach', 'page_impressions_unique', 'reach_unique'] as const

/** First positive reach value from an aggregation object, else 0. */
export function pickReach(agg: unknown, keys: readonly string[] = REACH_KEYS): number {
  if (!agg || typeof agg !== 'object') return 0
  const o = agg as Record<string, unknown>
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return Math.floor(v)
  }
  return 0
}
