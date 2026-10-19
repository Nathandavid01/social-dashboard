/** What the calendar saw in the Metricool list, compared against a fresh single read before any write. */
export type SeenCalendarPost = { uuid: string; draft: boolean; text: string; publicationDate: string; timezone?: string }
type ReadCalendarPost = { uuid: string; draft: boolean; text?: string | null; publicationDate: { dateTime: string; timezone: string } }

const caption = (text: string | null | undefined) => (text ?? '').normalize('NFC').replace(/\r\n?/g, '\n').trim()

/** Epoch ms of a naive wall-clock datetime in an IANA zone, or null when either is invalid. */
export function wallClockInstant(dateTime: string, timeZone = 'America/Puerto_Rico'): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(dateTime ?? '')
  if (!match) return null
  const [, y, mo, d, h, mi, s] = match.map(Number)
  const asUtc = Date.UTC(y, mo - 1, d, h, mi, s || 0)
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(asUtc)).map(p => [p.type, p.value]))
    const offset = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) - asUtc
    return asUtc - offset
  } catch { return null }
}

/**
 * Eric 2026-10-19: the calendar list asks Metricool for Puerto Rico times, but the single read returns the
 * post's stored zone and format, so a literal comparison reported «El post cambió» for untouched drafts.
 * Compare the same instant and the same caption instead; returns the fields that really changed.
 */
export function calendarPostChanges(original: ReadCalendarPost, seen: SeenCalendarPost): string[] {
  const changed: string[] = []
  if (original.uuid !== seen.uuid) changed.push('uuid')
  if (!!original.draft !== !!seen.draft) changed.push('draft')
  if (caption(original.text) !== caption(seen.text)) changed.push('text')
  const was = wallClockInstant(seen.publicationDate, seen.timezone || 'America/Puerto_Rico')
  const now = wallClockInstant(original.publicationDate?.dateTime, original.publicationDate?.timezone || 'America/Puerto_Rico')
  if (was === null || now === null || was !== now) changed.push('publicationDate')
  return changed
}
