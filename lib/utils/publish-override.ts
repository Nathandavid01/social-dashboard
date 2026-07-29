/**
 * Manual scheduling override for "Enviar a Metricool".
 *
 * Metricool receives a NAIVE "YYYY-MM-DDTHH:MM:SS" string and interprets it in
 * the account timezone (America/Puerto_Rico). It rejects anything in the past
 * with a 400 — so a chosen datetime has to be compared against `now` *in that
 * zone*, not in UTC and not in whatever zone the browser happens to be in.
 *
 * Pure + isolated so both the client control and the server action validate
 * with the exact same rule. Never trust the value the browser sent.
 */

export const POSTING_TZ = 'America/Puerto_Rico'

/**
 * How far ahead a chosen time must be. Publishing uploads the edited video and
 * pre-flights it before Metricool is ever called; picking "in one minute" turns
 * into a past datetime by the time the request lands.
 */
export const MIN_LEAD_MS = 5 * 60 * 1000

const NAIVE_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

/** Milliseconds `tz` is offset from UTC at the given instant. */
function tzOffsetMs(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  // hourCycle h23 still reports 24 for midnight in some engines.
  const hour = get('hour') % 24
  return Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second')) - utcMs
}

/**
 * Epoch ms for a naive "YYYY-MM-DDTHH:MM[:SS]" read as wall-clock time in `tz`.
 * Two passes: the first offset is looked up at the UTC-interpreted instant,
 * which can land on the wrong side of a DST edge, so it is re-checked at the
 * corrected instant. (Puerto Rico has no DST, but the helper must not depend on
 * that — `America/New_York` is covered by the tests.)
 */
export function zonedNaiveToEpoch(naive: string, tz: string = POSTING_TZ): number {
  const m = NAIVE_RE.exec(naive.trim())
  if (!m) return NaN
  const [, y, mo, d, h, mi, s] = m
  const guess = Date.UTC(+y, +mo - 1, +d, +h, +mi, s ? +s : 0)
  if (Number.isNaN(guess)) return NaN
  const firstPass = tzOffsetMs(guess, tz)
  return guess - tzOffsetMs(guess - firstPass, tz)
}

export type ScheduleOverrideResult =
  | { ok: true; iso: string }
  | { ok: false; error: string }

/**
 * Validate a user-chosen datetime. Returns the naive string to hand Metricool,
 * or the Spanish reason to show. `nowMs` is injectable for tests.
 */
export function validateScheduleOverride(
  value: string | null | undefined,
  nowMs: number = Date.now(),
  tz: string = POSTING_TZ,
): ScheduleOverrideResult {
  if (!value || !value.trim()) return { ok: false, error: 'Elige una fecha y hora' }

  const m = NAIVE_RE.exec(value.trim())
  if (!m) return { ok: false, error: 'Fecha y hora inválidas' }

  const [, y, mo, d, h, mi] = m
  // Reject 2026-13-45T99:99 — the regex shape matches but the calendar does not.
  const probe = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi))
  if (
    probe.getUTCFullYear() !== +y || probe.getUTCMonth() !== +mo - 1 || probe.getUTCDate() !== +d ||
    probe.getUTCHours() !== +h || probe.getUTCMinutes() !== +mi
  ) {
    return { ok: false, error: 'Fecha y hora inválidas' }
  }

  const iso = `${y}-${mo}-${d}T${h}:${mi}:00`
  const epoch = zonedNaiveToEpoch(iso, tz)
  if (Number.isNaN(epoch)) return { ok: false, error: 'Fecha y hora inválidas' }

  if (epoch <= nowMs) return { ok: false, error: 'Esa hora ya pasó — elige una futura' }
  if (epoch - nowMs < MIN_LEAD_MS) {
    return { ok: false, error: 'Deja al menos 5 minutos — el video tiene que subir primero' }
  }

  return { ok: true, iso }
}

/**
 * Naive string → the `YYYY-MM-DDTHH:MM` an `<input type="datetime-local">`
 * wants. `nudgeMs` shifts it forward, for defaulting the picker past a slot
 * that has already gone by.
 */
export function toDatetimeLocalValue(iso: string, nudgeMs = 0): string {
  const m = NAIVE_RE.exec(iso.trim())
  if (!m) return ''
  const [, y, mo, d, h, mi, s] = m
  if (!nudgeMs) return `${y}-${mo}-${d}T${h}:${mi}`
  // Shift on a UTC instant so the arithmetic never picks up a local DST jump —
  // these are wall-clock values, not real instants.
  const shifted = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, s ? +s : 0) + nudgeMs)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${shifted.getUTCFullYear()}-${p(shifted.getUTCMonth() + 1)}-${p(shifted.getUTCDate())}T${p(shifted.getUTCHours())}:${p(shifted.getUTCMinutes())}`
}
