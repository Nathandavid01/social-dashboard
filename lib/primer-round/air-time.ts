/** Show clock — overlay: lunes a viernes 5:43am–9:15am, Puerto Rico. */
export const PRIMER_ROUND_AIR_TZ = 'America/Puerto_Rico'
export const PRIMER_ROUND_AIR_HOUR = 5
export const PRIMER_ROUND_AIR_MINUTE = 43
export const PRIMER_ROUND_AIR_CLOCK = '5:43am'

export type PrimerRoundAirWhen = 'hoy' | 'mañana' | 'el lunes'

export type PrimerRoundAirCopy = {
  when: PrimerRoundAirWhen
  /** "mañana a las 5:43am" */
  phrase: string
}

function prWall(nowMs: number): { weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PRIMER_ROUND_AIR_TZ,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(nowMs))
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  const weekday = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[get('weekday')] ?? 0
  const hour = Number(get('hour')) % 24
  const minute = Number(get('minute'))
  return { weekday, minutes: hour * 60 + minute }
}

/**
 * Next time Primer Round is on air from `now` (Puerto Rico).
 * Sunday → "mañana a las 5:43am". Weekday before 5:43am → "hoy a las 5:43am".
 */
export function primerRoundNextAirCopy(nowMs = Date.now()): PrimerRoundAirCopy {
  const { weekday, minutes } = prWall(nowMs)
  const airMinutes = PRIMER_ROUND_AIR_HOUR * 60 + PRIMER_ROUND_AIR_MINUTE
  const weekdayMorning = weekday >= 1 && weekday <= 5 && minutes < airMinutes
  const when: PrimerRoundAirWhen = weekdayMorning
    ? 'hoy'
    : weekday === 0 || (weekday >= 1 && weekday <= 4)
      ? 'mañana'
      : 'el lunes'
  const phrase = `${when} a las ${PRIMER_ROUND_AIR_CLOCK}`
  return { when, phrase }
}

/** "hoy en Primer Round" / stale air phrases → the next live air time. */
const ATTRIBUTION_WHEN =
  /(?:hoy(?: a las 5:43am)?|mañana a las 5:43am|el lunes a las 5:43am)(?= en Primer Round junto a)/gi

/**
 * Force the live air phrase. Sunday posted today → "mañana a las 5:43am".
 */
export function applyPrimerRoundAirPhrase(
  caption: string,
  air: PrimerRoundAirCopy = primerRoundNextAirCopy(),
): string {
  if (!caption.trim()) return caption
  ATTRIBUTION_WHEN.lastIndex = 0
  return caption.replace(ATTRIBUTION_WHEN, air.phrase)
}
