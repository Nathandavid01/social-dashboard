export type RecordingConfirmationStatus = 'unconfirmed' | 'confirmed'

export type RecordingConfirmationFields = {
  client_id?: string | null
  videographer_id?: string | null
  start_time?: string | null
}

/** Incomplete = missing client OR videographer OR start_time (≠ need-to-schedule). */
export function isRecordingSessionIncomplete(fields: RecordingConfirmationFields): boolean {
  const clientOk = typeof fields.client_id === 'string' && fields.client_id.trim().length > 0
  const videoOk = typeof fields.videographer_id === 'string' && fields.videographer_id.trim().length > 0
  const timeOk = typeof fields.start_time === 'string' && fields.start_time.trim().length > 0
  return !(clientOk && videoOk && timeOk)
}

export function isRecordingSessionComplete(fields: RecordingConfirmationFields): boolean {
  return !isRecordingSessionIncomplete(fields)
}

/**
 * On save: confirmed when client + videographer + start_time are all set.
 * Explicit Confirmar/Unconfirmar overrides via `explicit`.
 */
export function resolveConfirmationStatus(
  fields: RecordingConfirmationFields,
  explicit?: RecordingConfirmationStatus | null,
): RecordingConfirmationStatus {
  if (explicit === 'confirmed' || explicit === 'unconfirmed') return explicit
  return isRecordingSessionComplete(fields) ? 'confirmed' : 'unconfirmed'
}

/**
 * Display protocol for todo / Mi Día chips:
 * Confirmada when confirmation_status === 'confirmed' OR client+videographer+start_time.
 * (Explicit stored `unconfirmed` still yields Confirmada if the three fields are set —
 * incompleteness of prep is separate from confirmation visibility.)
 */
export function effectiveConfirmationStatus(
  fields: RecordingConfirmationFields & {
    confirmation_status?: RecordingConfirmationStatus | null
  },
): RecordingConfirmationStatus {
  if (fields.confirmation_status === 'confirmed') return 'confirmed'
  return isRecordingSessionComplete(fields) ? 'confirmed' : 'unconfirmed'
}

export function confirmationStatusLabel(
  status: RecordingConfirmationStatus,
): 'Confirmada' | 'Sin confirmar' {
  return status === 'confirmed' ? 'Confirmada' : 'Sin confirmar'
}
