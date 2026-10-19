import { publicationInstant } from './publication-date'

/** What the calendar saw in the Metricool list, compared against a fresh single read before any write. */
export type SeenCalendarPost = { uuid: string; draft: boolean; text: string; publicationDate: string; timezone?: string }
type ReadCalendarPost = { uuid: string; draft: boolean; text?: string | null; publicationDate: { dateTime: string; timezone: string } }

const caption = (text: string | null | undefined) => (text ?? '').normalize('NFC').replace(/\r\n?/g, '\n').trim()

/** Epoch ms of a Metricool date: an absolute ISO timestamp, or wall time in an IANA zone; null when unreadable. */
export function wallClockInstant(dateTime: string, timeZone = 'America/Puerto_Rico'): number | null {
  const instant = publicationInstant({ dateTime, timezone: timeZone })
  return instant ? Date.parse(instant) : null
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

/** The stored instant as a Puerto Rico wall clock (UTC−4, no DST), «YYYY-MM-DDTHH:mm», or null. */
export function puertoRicoWallClock(dateTime: string, timeZone = 'America/Puerto_Rico'): string | null {
  const instant = wallClockInstant(dateTime, timeZone)
  return instant === null ? null : new Date(instant - 4 * 3_600_000).toISOString().slice(0, 16)
}
