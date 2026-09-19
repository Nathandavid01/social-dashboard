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
