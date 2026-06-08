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

    const e = byUser.get(v.uploaded_by) ?? { userId: v.uploaded_by, raw: 0, broll: 0, edited: 0, total: 0 }
    if (v.kind === 'raw' || v.kind === 'broll' || v.kind === 'edited') {
      e[v.kind]++
      e.total++
    }
    byUser.set(v.uploaded_by, e)
  }

  return Array.from(byUser.values())
}

/** Left-join aggregated rows against a profiles lookup to resolve display names. */
export function joinUserNames(
  rows: UserUploadCounts[],
  profiles: { id: string; full_name: string | null }[],
): NamedUserUploadCounts[] {
  const names = new Map(profiles.map((p) => [p.id, p.full_name]))
  return rows.map((r) => ({ ...r, userName: names.get(r.userId) ?? null }))
}
