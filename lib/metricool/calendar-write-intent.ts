import { puertoRicoWallClock } from './calendar-stale'

export function calendarWriteNeedsMetricool(input: {
  action: 'draft' | 'schedule' | 'delete'
  currentDraft: boolean
  currentDateTime: string
  currentTimezone?: string
  requestedDateTime?: string
}): boolean {
  if (input.action === 'delete') return true
  const current = puertoRicoWallClock(input.currentDateTime, input.currentTimezone)
  const requestedRaw = input.requestedDateTime
  const requested = requestedRaw
    ? puertoRicoWallClock(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(requestedRaw) ? `${requestedRaw}:00` : requestedRaw, 'America/Puerto_Rico')
    : current
  if (input.action === 'draft') return !input.currentDraft || (requested != null && requested !== current)
  if (!requested) return true
  return input.currentDraft || requested !== current
}
