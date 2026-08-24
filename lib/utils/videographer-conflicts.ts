export interface VideographerConflict {
  videographerId: string
  videographerName: string
  date: string
  sessionIds: string[]
}

type ConflictSession = {
  id: string
  session_date: string
  videographer_id?: string | null
  status?: string | null
  videographer?: { full_name?: string | null } | null
}

function monthKey(month: Date): string {
  const y = month.getFullYear()
  const m = String(month.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/** Same videographer, same day, 2+ sessions that are still on (not cancelled). */
export function videographerConflictsInRange(
  sessions: ConflictSession[],
  month: Date,
): VideographerConflict[] {
  const prefix = monthKey(month)
  const groups = new Map<string, ConflictSession[]>()

  for (const session of sessions) {
    if (session.status === 'cancelled') continue
    if (!session.videographer_id) continue
    if (!session.session_date.startsWith(prefix)) continue
    const key = `${session.videographer_id}|${session.session_date}`
    const list = groups.get(key) ?? []
    list.push(session)
    groups.set(key, list)
  }

  const conflicts: VideographerConflict[] = []
  Array.from(groups.values()).forEach((list) => {
    if (list.length < 2) return
    const first = list[0]
    conflicts.push({
      videographerId: first.videographer_id as string,
      videographerName: first.videographer?.full_name?.trim() || 'Videógrafo',
      date: first.session_date,
      sessionIds: list.map((s: ConflictSession) => s.id),
    })
  })
  return conflicts.sort((a, b) => a.date.localeCompare(b.date) || a.videographerName.localeCompare(b.videographerName))
}
