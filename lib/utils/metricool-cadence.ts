/**
 * Infer a client's posting cadence from their Metricool history.
 *
 * Given a list of published posts (with publicationDate), compute:
 *   - postsPerWeek average across the analysis window
 *   - distribution of posts by day-of-week
 *   - the most likely "active days" (those with a frequency ≥ threshold)
 *
 * The output is meant to be a *suggestion* — the operator may adopt it as
 * `clients.posting_days` or override it.
 */

export interface MetricoolPostMinimal {
  publicationDate?: { dateTime: string }
  draft?: boolean
  /** Optional: only count posts that actually went live. */
  providers?: { status?: string; network?: string }[]
}

export interface InferredCadence {
  /** Number of posts inspected after filtering drafts/errors. */
  totalCounted: number
  /** Span of the analysis window in days. */
  windowDays: number
  /** Posts per week, averaged over the window. */
  postsPerWeekAvg: number
  /** 0..6 (Sun..Sat) → count of posts on that weekday. */
  countByDayOfWeek: Record<number, number>
  /** Subset of 0..6 that are "active" (≥ activeThreshold of total). */
  activeDays: number[]
  /** Suggested integer target for posts/week (rounded). */
  suggestedPerWeek: number
  /** Most common posting time across the whole window, as "HH:MM" (local TZ of post). */
  typicalTimeOverall: string | null
  /** Per active day → typical "HH:MM" (median of bucketized 30-min slots). */
  typicalTimeByDay: Record<number, string | null>
  /** Network → posts-on-that-network count. */
  platformCounts: Record<string, number>
  /** Networks that account for ≥ 20% of total — the client's actual platforms. */
  topPlatforms: string[]
}

// 8 weeks of history — enough sample, recent enough to reflect current cadence.
const DEFAULT_WINDOW_DAYS = 56
/** A day counts as "active" if it holds ≥ 8% of the total volume. */
const ACTIVE_THRESHOLD_RATIO = 0.08

/** Round minutes to the nearest 30-min bucket and return "HH:MM". */
function bucketTime(date: Date): string {
  const h = date.getHours()
  const m = date.getMinutes()
  const bucketM = m < 15 ? 0 : m < 45 ? 30 : 0
  const bucketH = m < 45 ? h : (h + 1) % 24
  return `${String(bucketH).padStart(2, '0')}:${String(bucketM).padStart(2, '0')}`
}

/** Most frequent value, ties broken by latest. */
function mode<T extends string>(values: T[]): T | null {
  if (values.length === 0) return null
  const counts = new Map<T, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best: T | null = null
  let bestCount = 0
  counts.forEach((c, v) => {
    if (c > bestCount) {
      best = v
      bestCount = c
    }
  })
  return best
}

export function inferCadenceFromMetricoolPosts(
  posts: MetricoolPostMinimal[] | null | undefined,
  options: { windowDays?: number; refDate?: Date; activeThresholdRatio?: number } = {},
): InferredCadence {
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS
  const ref = options.refDate ?? new Date()
  const threshold = options.activeThresholdRatio ?? ACTIVE_THRESHOLD_RATIO
  const windowStart = new Date(ref.getTime() - windowDays * 24 * 60 * 60 * 1000)

  const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
  const timesByDay: Record<number, string[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
  const platformCounts: Record<string, number> = {}
  const allTimes: string[] = []
  let total = 0

  for (const p of posts ?? []) {
    if (p.draft) continue
    const iso = p.publicationDate?.dateTime
    if (!iso) continue
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) continue
    if (d < windowStart || d > ref) continue
    // Only count if at least one provider succeeded (or no provider info).
    let publishedNetworks: string[] = []
    if (p.providers && p.providers.length > 0) {
      publishedNetworks = p.providers
        .filter((pr) => (pr.status ?? '').toUpperCase() === 'PUBLISHED' && pr.network)
        .map((pr) => pr.network as string)
      if (publishedNetworks.length === 0) continue
    }
    const dow = d.getDay()
    const bucket = bucketTime(d)
    counts[dow]++
    timesByDay[dow].push(bucket)
    allTimes.push(bucket)
    for (const n of publishedNetworks) {
      platformCounts[n] = (platformCounts[n] ?? 0) + 1
    }
    total++
  }

  const platformThreshold = total * 0.2
  const topPlatforms = Object.entries(platformCounts)
    .filter(([, c]) => c >= platformThreshold && c > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([n]) => n)

  const weeks = windowDays / 7
  const postsPerWeekAvg = weeks > 0 ? total / weeks : 0

  const minCount = total * threshold
  const activeDays = ([0, 1, 2, 3, 4, 5, 6] as const).filter((d) => counts[d] >= minCount && counts[d] > 0)

  const typicalTimeByDay: Record<number, string | null> = { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null }
  for (const d of [0, 1, 2, 3, 4, 5, 6] as const) {
    typicalTimeByDay[d] = mode(timesByDay[d])
  }

  return {
    totalCounted: total,
    windowDays,
    postsPerWeekAvg,
    countByDayOfWeek: counts,
    activeDays: [...activeDays],
    suggestedPerWeek: Math.round(postsPerWeekAvg),
    typicalTimeOverall: mode(allTimes),
    typicalTimeByDay,
    platformCounts,
    topPlatforms,
  }
}
