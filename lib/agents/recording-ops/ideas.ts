import { requiredForOnsite } from '../../onsite/slot-count'
import { countLinkedIdeas } from './code-agent'
import type { IdeaAssignment, OpsClient, RecordingSession, SessionIdea } from './types'

function clientFor(session: RecordingSession, clients: OpsClient[]): OpsClient | undefined {
  if (!session.client_id) return undefined
  return clients.find((client) => client.id === session.client_id)
}

/**
 * Per upcoming session: On Site quota (`requiredForOnsite` / posting_days)
 * and editor assignee (`clients.assigned_to`).
 */
export function buildIdeaAssignments(
  sessions: RecordingSession[],
  ideas: SessionIdea[],
  clients: OpsClient[],
): IdeaAssignment[] {
  return sessions
    .map((session) => {
      const client = clientFor(session, clients)
      const requiredCount = requiredForOnsite({
        postingDays: client?.posting_days,
        ref: new Date(`${session.session_date}T12:00:00`),
      }).slotTarget
      const linkedCount = countLinkedIdeas(session, ideas)
      return {
        sessionId: session.id,
        clientId: session.client_id,
        clientName: client?.name || session.client_name?.trim() || session.title,
        sessionDate: session.session_date,
        requiredCount,
        linkedCount,
        pendingCount: Math.max(0, requiredCount - linkedCount),
        assigneeId: client?.assigned_to ?? null,
        assigneeName: client?.assignee_name ?? null,
      }
    })
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate) || a.sessionId.localeCompare(b.sessionId))
}
