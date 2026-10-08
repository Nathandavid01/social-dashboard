import { confirmationMissingSides } from './code-agent'
import type { RecordingSession, ReminderPayload, UnconfirmedClient } from './types'

export function listUnconfirmedClients(sessions: RecordingSession[]): UnconfirmedClient[] {
  return sessions
    .filter((session) => confirmationMissingSides(session).length > 0)
    .map((session) => ({
      sessionId: session.id,
      clientId: session.client_id,
      clientName: session.client_name?.trim() || session.title,
      sessionDate: session.session_date,
      startTime: session.start_time,
      confirmationStatus: 'unconfirmed' as const,
      missingSides: confirmationMissingSides(session),
    }))
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate) || a.sessionId.localeCompare(b.sessionId))
}

const SIDE_LABEL = { client: 'cliente', videographer: 'videógrafo' } as const

/** Draft reminder payloads only. Do not send email or Slack. */
export function draftConfirmationReminders(unconfirmed: UnconfirmedClient[]): ReminderPayload[] {
  return unconfirmed.map((row) => {
    const sides = row.missingSides.map((side) => SIDE_LABEL[side]).join(' y ')
    return {
      sessionId: row.sessionId,
      channel: 'in_app',
      to: row.clientName,
      subject: `Confirmar grabación · ${row.clientName} · ${row.sessionDate}`,
      body:
        `Recordatorio (no enviado): ${row.clientName} el ${row.sessionDate}` +
        `${row.startTime ? ` a las ${row.startTime}` : ''}. Falta confirmar: ${sides}. ` +
        `Confirmada solo cuando cliente y videógrafo marcan en el dashboard.`,
      send: false,
    }
  })
}
