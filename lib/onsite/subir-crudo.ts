/**
 * Helpers for the On Site «Subir crudo» door.
 * Session writes still go through createRecordingSession — no parallel insert.
 */

export function todaySessionsForClient<T extends { clientId: string | null; date: string }>(
  sessions: T[],
  clientId: string,
  today: string,
): T[] {
  if (!clientId) return []
  return sessions.filter((s) => s.clientId === clientId && s.date === today)
}

/** One today session → pick it. Several or none → the user chooses / we create. */
export function pickTodaySession<T>(todaySessions: T[]): T | null {
  return todaySessions.length === 1 ? todaySessions[0] : null
}

/**
 * Ready to upload against a session?
 * - Has a selected/auto session → yes
 * - Zero today sessions → only if we can create one
 * - Several today sessions with none chosen → no (never invent a duplicate)
 */
export function canResolveSessionTarget(input: {
  todaySessionCount: number
  sessionId: string
  canCreateSession: boolean
}): boolean {
  if (input.sessionId) return true
  if (input.todaySessionCount === 0) return input.canCreateSession
  return false
}

/** Deep-link to the uploaded idea/session in Pipeline — never the generic board. */
export function pipelineDeepLink(input: {
  clientId?: string | null
  ideaId?: string | null
  sessionId?: string | null
}): string {
  const params = new URLSearchParams()
  const clientId = input.clientId?.trim()
  const ideaId = input.ideaId?.trim()
  const sessionId = input.sessionId?.trim()
  if (clientId) params.set('lote', clientId)
  if (ideaId) params.set('idea', ideaId)
  if (sessionId) params.set('sesion', sessionId)
  const qs = params.toString()
  return qs ? `/pipeline?${qs}` : '/pipeline'
}

export function todaySessionCreateValues(input: {
  clientId: string
  clientName: string
  today: string
}): { session_date: string; client_id: string; title: string } {
  const title = input.clientName.trim() || 'Grabación'
  return {
    session_date: input.today,
    client_id: input.clientId,
    title,
  }
}
