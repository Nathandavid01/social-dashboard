/** Show clock — overlay: lunes a viernes 5:43 AM–9:15 AM, Puerto Rico. */
export const PRIMER_ROUND_AIR_TZ = 'America/Puerto_Rico'
export const PRIMER_ROUND_AIR_HOUR = 5
export const PRIMER_ROUND_AIR_MINUTE = 43
/** Facebook clock: "desde las 5:43 AM". */
export const PRIMER_ROUND_AIR_CLOCK = '5:43 AM'

export type PrimerRoundAirWhen = 'hoy' | 'mañana' | 'el lunes'

export type PrimerRoundAirCopy = {
  when: PrimerRoundAirWhen
  /** "mañana desde las 5:43 AM" */
  phrase: string
  /** "Mañana desde las 5:43 AM" — starts the sentence on Facebook. */
  phraseStart?: string
}

export function primerRoundTitleWhen(when: PrimerRoundAirWhen): string {
  if (when === 'el lunes') return 'El lunes'
  if (when === 'mañana') return 'Mañana'
  return 'Hoy'
}

export function primerRoundAirPhrase(when: PrimerRoundAirWhen, startOfLine = false): string {
  const lead = startOfLine ? primerRoundTitleWhen(when) : when
  return `${lead} desde las ${PRIMER_ROUND_AIR_CLOCK}`
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
 * Sunday → "Mañana desde las 5:43 AM". Weekday before 5:43 AM → "Hoy desde las 5:43 AM".
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
  return {
    when,
    phrase: primerRoundAirPhrase(when, false),
    phraseStart: primerRoundAirPhrase(when, true),
  }
}

/** Old and Facebook when-phrases before "junto a". */
const ATTRIBUTION_WHEN =
  /(?:hoy|mañana|el lunes)(?: a las 5:43am| desde las 5:43 ?AM)?(?: en Primer Round)?(?= junto a)/gi

/**
 * Force the live Facebook air phrase.
 * Sunday posted today → "Mañana desde las 5:43 AM".
 */
export function applyPrimerRoundAirPhrase(
  caption: string,
  air: PrimerRoundAirCopy = primerRoundNextAirCopy(),
): string {
  if (!caption.trim()) return caption
  ATTRIBUTION_WHEN.lastIndex = 0
  return caption.replace(ATTRIBUTION_WHEN, air.phrase)
}
