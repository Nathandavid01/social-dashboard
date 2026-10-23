import { listMissingVideographer } from './code-agent'
import {
  SIN_VIDEO_LABEL,
  type OpsVideographer,
  type RecordingSession,
  type VideographerGap,
} from './types'

function sessionsOnDate(sessions: RecordingSession[], date: string): RecordingSession[] {
  return sessions.filter((session) => session.session_date === date && session.videographer_id)
}

function loadByVideographer(sessions: RecordingSession[]): Map<string, number> {
  const load = new Map<string, number>()
  for (const session of sessions) {
    const id = session.videographer_id?.trim()
    if (!id) continue
    load.set(id, (load.get(id) ?? 0) + 1)
  }
  return load
}

/**
 * Propose a videographer for a SIN VIDEO day: free that calendar day,
 * then lowest window load. Does not write.
 */
export function proposeVideographer(
  gap: RecordingSession,
  roster: OpsVideographer[],
  scheduled: RecordingSession[],
): Pick<VideographerGap, 'proposedVideographerId' | 'proposedVideographerName' | 'rationale'> {
  const busy = new Set(sessionsOnDate(scheduled, gap.session_date).map((row) => row.videographer_id as string))
  const load = loadByVideographer(scheduled)
  const free = roster
    .filter((person) => !busy.has(person.id))
    .slice()
    .sort((a, b) => {
      const loadDiff = (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0)
      if (loadDiff !== 0) return loadDiff
      return a.full_name.localeCompare(b.full_name)
    })

  const pick = free[0]
  if (!pick) {
    return {
      proposedVideographerId: null,
      proposedVideographerName: null,
      rationale: `${SIN_VIDEO_LABEL} el ${gap.session_date}: nadie libre ese día. Asignación humana.`,
    }
  }
  return {
    proposedVideographerId: pick.id,
    proposedVideographerName: pick.full_name,
    rationale: `${SIN_VIDEO_LABEL} el ${gap.session_date}: proponer ${pick.full_name} (libre ese día, menor carga en la ventana). No auto-escribir.`,
  }
}

export function detectVideographerGaps(
  scheduled: RecordingSession[],
  roster: OpsVideographer[],
): VideographerGap[] {
  return listMissingVideographer(scheduled).map((session) => {
    const proposal = proposeVideographer(session, roster, scheduled)
    return {
      sessionId: session.id,
      sessionDate: session.session_date,
      clientName: session.client_name?.trim() || session.title,
      currentVideographerId: session.videographer_id,
      label: SIN_VIDEO_LABEL,
      ...proposal,
    }
  })
}
