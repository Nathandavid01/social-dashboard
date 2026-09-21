import { SIN_VIDEO_LABEL, type RecordingSession, type SchedulerAssignment } from './types'

function sessionLabel(session: RecordingSession): string {
  const name = session.client_name?.trim() || session.title
  const time = session.start_time ? ` ${session.start_time}` : ''
  return `${session.session_date}${time} (${name})`
}

/** Group scheduled sessions by videographer / SIN VIDEO and draft assignment messages. */
export function buildSchedulerAssignments(sessions: RecordingSession[]): SchedulerAssignment[] {
  const groups = new Map<string, RecordingSession[]>()
  for (const session of sessions) {
    const key = session.videographer_id?.trim() || SIN_VIDEO_LABEL
    const list = groups.get(key) ?? []
    list.push(session)
    groups.set(key, list)
  }

  return [...groups.entries()]
    .map(([key, rows]) => {
      const ordered = rows
        .slice()
        .sort((a, b) => a.session_date.localeCompare(b.session_date) || a.id.localeCompare(b.id))
      const videographerId = key === SIN_VIDEO_LABEL ? null : key
      const videographerName =
        videographerId == null
          ? SIN_VIDEO_LABEL
          : (ordered[0]?.videographer_name?.trim() || videographerId)
      const days = [...new Set(ordered.map((row) => row.session_date))]
      const sessionIds = ordered.map((row) => row.id)
      const who = videographerName
      const message =
        videographerId == null
          ? `${SIN_VIDEO_LABEL}: ${ordered.map(sessionLabel).join(', ')} — asignar videógrafo.`
          : `${who} graba ${ordered.map(sessionLabel).join(', ')}.`
      return { videographerId, videographerName, days, sessionIds, message }
    })
    .sort((a, b) => {
      if (a.videographerId == null) return 1
      if (b.videographerId == null) return -1
      return a.videographerName.localeCompare(b.videographerName)
    })
}
