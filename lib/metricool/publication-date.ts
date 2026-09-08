import type { ScheduledPost } from './scheduler'
const TIMEZONE = 'America/Puerto_Rico'

export function puertoRicoDay(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

/** Metricool sends either an absolute ISO timestamp or wall time + IANA zone. */
export function publicationDay(value: ScheduledPost['publicationDate']): string | null {
  const raw = value?.dateTime
  if (!raw) return null
  try {
    if (/(Z|[+-]\d{2}:?\d{2})$/i.test(raw)) {
      const instant = new Date(raw)
      return Number.isFinite(instant.getTime()) ? puertoRicoDay(instant) : null
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(raw)
    if (!match) return null
    const parts = match.slice(1).map(part => Number(part || 0))
    const wall = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5])
    const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: value.timezone || TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    const localEpoch = (instant: number) => {
      const p = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(part => [part.type, part.value]))
      return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second))
    }
    // Resolve the zone offset without depending on the server's own timezone.
    let instant = wall
    for (let n = 0; n < 4; n++) {
      const difference = wall - localEpoch(instant)
      if (!difference) break
      instant += difference
    }
    // Reject impossible wall times (e.g. a daylight-saving gap).
    if (localEpoch(instant) !== wall || new Date(wall).toISOString().slice(0, 16) !== raw.slice(0, 16)) return null
    return puertoRicoDay(new Date(instant))
  } catch { return null }
}

