/**
 * Pure aggregation of uploaded video files per user, split by kind (raw / b-roll
 * / edited). The Supabase action `getVideoUploadMetricsByUser` wraps these so the
 * counting logic stays testable without a database.
 */

export type UploadKind = 'raw' | 'broll' | 'edited'

export interface UploadRow {
  uploaded_by: string | null
  kind: UploadKind | string
  status: string
  uploaded_at?: string | null
}

export interface UserUploadCounts {
  userId: string
  raw: number
  broll: number
  edited: number
  total: number
  /** Most recent uploaded_at across this user's (non-archived) files. null = none. */
  lastUploadAt: string | null
}

export interface NamedUserUploadCounts extends UserUploadCounts {
  userName: string | null
}

/**
 * Count uploads per user per kind. Excludes archived files and rows with no
 * uploader; optionally scopes to uploads on/after `opts.since` (a "YYYY-MM-DD"
 * or ISO string, lexicographically comparable to `uploaded_at`).
 */
export function aggregateUploadsByUser(
  videos: UploadRow[],
  opts?: { since?: string },
): UserUploadCounts[] {
  const since = opts?.since
  const byUser = new Map<string, UserUploadCounts>()

  for (const v of videos) {
    if (!v.uploaded_by) continue
    if (v.status === 'archived') continue
    if (since && v.uploaded_at && v.uploaded_at < since) continue

    const e = byUser.get(v.uploaded_by) ?? { userId: v.uploaded_by, raw: 0, broll: 0, edited: 0, total: 0, lastUploadAt: null }
    if (v.kind === 'raw' || v.kind === 'broll' || v.kind === 'edited') {
      e[v.kind]++
      e.total++
    }
    if (v.uploaded_at && (e.lastUploadAt === null || v.uploaded_at > e.lastUploadAt)) {
      e.lastUploadAt = v.uploaded_at
    }
    byUser.set(v.uploaded_by, e)
  }

  return Array.from(byUser.values())
}

/**
 * Edited-to-raw throughput as a rounded percentage (edited / raw). A post-
 * production signal: ~100% means every captured clip got edited. null when there
 * are no raw uploads to compare against.
 */
export function editedRatioPct(c: { raw: number; edited: number }): number | null {
  if (c.raw === 0) return null
  return Math.round((c.edited / c.raw) * 100)
}

/**
 * How stale a user's last upload is, given a reference "now". Returns whole days
 * since the last upload (0 = today) and a tone bucket for the badge. null when
 * the user has never uploaded.
 */
export function uploadStaleness(
  lastUploadAt: string | null,
  nowMs: number = Date.now(),
): { days: number; tone: 'fresh' | 'aging' | 'stale' } | null {
  if (!lastUploadAt) return null
  const then = new Date(lastUploadAt).getTime()
  if (Number.isNaN(then)) return null
  const days = Math.max(0, Math.floor((nowMs - then) / 86_400_000))
  const tone = days <= 3 ? 'fresh' : days <= 10 ? 'aging' : 'stale'
  return { days, tone }
}

/** Left-join aggregated rows against a profiles lookup to resolve display names. */
export function joinUserNames(
  rows: UserUploadCounts[],
  profiles: { id: string; full_name: string | null }[],
): NamedUserUploadCounts[] {
  const names = new Map(profiles.map((p) => [p.id, p.full_name]))
  return rows.map((r) => ({ ...r, userName: names.get(r.userId) ?? null }))
}
