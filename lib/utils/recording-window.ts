/**
 * Recording-window sizing for the Workflow board.
 *
 * A client records every `recording_interval_weeks` weeks. We only want to show
 * the ideas needed to cover that window — roughly (posts per week × interval).
 * Beyond that, ideas are "más adelante" and hidden so the board reflects only
 * what has to be recorded now.
 *
 * Pure + dependency-free so it can be unit-tested without a DB.
 */

export const DEFAULT_RECORDING_INTERVAL_WEEKS = 2

/** How many videos to surface for a client given their cadence + interval. */
export function recordingWindowSize(postingDaysPerWeek: number, intervalWeeks: number): number {
  const perWeek = Math.max(Math.floor(postingDaysPerWeek) || 0, 1)
  const weeks = Math.max(Math.floor(intervalWeeks) || 0, 1)
  return perWeek * weeks
}

/** Resolve a client's interval, falling back to the default when unset/invalid. */
export function resolveInterval(weeks: number | null | undefined): number {
  if (typeof weeks === 'number' && weeks >= 1 && weeks <= 12) return Math.floor(weeks)
  return DEFAULT_RECORDING_INTERVAL_WEEKS
}
