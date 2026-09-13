export type RecordingConfirmationStatus = 'unconfirmed' | 'confirmed'

/** Chip detail for Mi Día / calendar — missing side(s) when not fully confirmed. */
export type RecordingConfirmationChip =
  | 'confirmed'
  | 'missing_videographer'
  | 'missing_client'
  | 'unconfirmed'

export type RecordingDualConfirmationFields = {
  videographer_confirmed_at?: string | null
  client_confirmed_at?: string | null
  /** Denormalized cache; ignored for effective Confirmada (dual timestamps win). */
  confirmation_status?: RecordingConfirmationStatus | null
}

/** Schedule completeness (client + videographer + start_time) — NOT confirmation. */
export type RecordingScheduleFields = {
  client_id?: string | null
  videographer_id?: string | null
  start_time?: string | null
}

function isPresentTimestamp(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

export function hasVideographerConfirmed(fields: RecordingDualConfirmationFields): boolean {
  return isPresentTimestamp(fields.videographer_confirmed_at)
}

export function hasClientConfirmed(fields: RecordingDualConfirmationFields): boolean {
  return isPresentTimestamp(fields.client_confirmed_at)
}

/**
 * Confirmada iff BOTH parties explicitly confirmed.
 * Field-complete (client + videógrafo + hora) is NOT sufficient.
 */
export function effectiveConfirmationStatus(
  fields: RecordingDualConfirmationFields,
): RecordingConfirmationStatus {
  return hasVideographerConfirmed(fields) && hasClientConfirmed(fields)
    ? 'confirmed'
    : 'unconfirmed'
}

/** Derive denormalized confirmation_status from dual timestamps (write-path helper). */
export function resolveConfirmationStatus(
  fields: RecordingDualConfirmationFields,
): RecordingConfirmationStatus {
  return effectiveConfirmationStatus(fields)
}

export function confirmationChip(
  fields: RecordingDualConfirmationFields,
): RecordingConfirmationChip {
  const videoOk = hasVideographerConfirmed(fields)
  const clientOk = hasClientConfirmed(fields)
  if (videoOk && clientOk) return 'confirmed'
  if (clientOk && !videoOk) return 'missing_videographer'
  if (videoOk && !clientOk) return 'missing_client'
  return 'unconfirmed'
}

export function confirmationStatusLabel(
  chip: RecordingConfirmationChip | RecordingConfirmationStatus,
): 'Confirmada' | 'Falta videógrafo' | 'Falta cliente' | 'Sin confirmar' {
  switch (chip) {
    case 'confirmed':
      return 'Confirmada'
    case 'missing_videographer':
      return 'Falta videógrafo'
    case 'missing_client':
      return 'Falta cliente'
    default:
      return 'Sin confirmar'
  }
}

/** Incomplete schedule = missing client OR videographer OR start_time (≠ confirmation). */
export function isRecordingSessionIncomplete(fields: RecordingScheduleFields): boolean {
  const clientOk = typeof fields.client_id === 'string' && fields.client_id.trim().length > 0
  const videoOk = typeof fields.videographer_id === 'string' && fields.videographer_id.trim().length > 0
  const timeOk = typeof fields.start_time === 'string' && fields.start_time.trim().length > 0
  return !(clientOk && videoOk && timeOk)
}

export function isRecordingSessionComplete(fields: RecordingScheduleFields): boolean {
  return !isRecordingSessionIncomplete(fields)
}
