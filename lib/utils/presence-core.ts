import { addDaysISO } from './deadlines'

/** Sin latido en 3 min se corta la sesión (pestaña olvidada no cuenta). */
export const PRESENCE_IDLE_MS = 180_000
/** "En estudio" si el último latido fue hace menos de 90s. */
export const PRESENCE_LIVE_MS = 90_000
/** Jornada de dashboard: 4 horas. No es el día laboral entero — el resto
 *  se graba y edita fuera. */
export const JORNADA_TARGET_SECONDS = 4 * 3600
export const PRESENCE_BEAT_MS = 60_000
export const PRESENCE_TZ = 'America/Puerto_Rico'

export interface PresenceDayRow {
  user_id: string
  day: string
  active_seconds: number
  last_beat_at: string | null
}

export interface PresencePerson {
  id: string
  full_name: string | null
  avatar_url: string | null
}

export interface RankedMember {
  user_id: string
  full_name: string | null
  avatar_url: string | null
  today_seconds: number
  week_seconds: number
  last_beat_at: string | null
  streak_days: number
  live: boolean
  rank: number
}

export function applyHeartbeat(
  prev: { last_beat_at: string | null; active_seconds: number } | null,
  now: Date,
  idleMs = PRESENCE_IDLE_MS,
): { last_beat_at: string; active_seconds: number; secondsAdded: number } {
  const nowIso = now.toISOString()
  if (!prev || !prev.last_beat_at) {
    return { last_beat_at: nowIso, active_seconds: prev?.active_seconds ?? 0, secondsAdded: 0 }
  }
  const last = new Date(prev.last_beat_at).getTime()
  const gap = now.getTime() - last
  if (!(gap > 0)) {
    return { last_beat_at: prev.last_beat_at, active_seconds: prev.active_seconds, secondsAdded: 0 }
  }
  if (gap > idleMs) {
    return { last_beat_at: nowIso, active_seconds: prev.active_seconds, secondsAdded: 0 }
  }
  const secondsAdded = Math.round(gap / 1000)
  return {
    last_beat_at: nowIso,
    active_seconds: prev.active_seconds + secondsAdded,
    secondsAdded,
  }
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function weekStartMonday(day: string): string {
  const [y, mo, d] = day.split('-').map(Number)
  const date = new Date(y, mo - 1, d)
  const weekday = date.getDay() // 0 Sun … 6 Sat
  const delta = weekday === 0 ? -6 : 1 - weekday
  return addDaysISO(day, delta)
}

export function isLive(lastBeatAt: string | null, now: Date = new Date(), windowMs = PRESENCE_LIVE_MS): boolean {
  if (!lastBeatAt) return false
  const t = new Date(lastBeatAt).getTime()
  if (!Number.isFinite(t)) return false
  return now.getTime() - t <= windowMs
}

export function jornadaProgress(todaySeconds: number, target = JORNADA_TARGET_SECONDS): number {
  if (target <= 0) return 0
  return Math.min(1, Math.max(0, todaySeconds / target))
}

export function streakDays(present: Set<string>, today: string): number {
  const start = present.has(today) ? today : addDaysISO(today, -1)
  let count = 0
  let cursor = start
  while (present.has(cursor)) {
    count += 1
    cursor = addDaysISO(cursor, -1)
  }
  return count
}

export function rankMembers(
  people: PresencePerson[],
  rows: PresenceDayRow[],
  opts: { today: string; weekStart: string; now: Date },
): RankedMember[] {
  const byUser = new Map<string, PresenceDayRow[]>()
  for (const row of rows) {
    const list = byUser.get(row.user_id) ?? []
    list.push(row)
    byUser.set(row.user_id, list)
  }

  const ranked: RankedMember[] = people.map((p) => {
    const theirs = byUser.get(p.id) ?? []
    const todayRow = theirs.find((r) => r.day === opts.today)
    const weekRows = theirs.filter((r) => r.day >= opts.weekStart && r.day <= opts.today)
    const present = new Set(theirs.filter((r) => r.active_seconds > 0).map((r) => r.day))
    return {
      user_id: p.id,
      full_name: p.full_name,
      avatar_url: p.avatar_url,
      today_seconds: todayRow?.active_seconds ?? 0,
      week_seconds: weekRows.reduce((n, r) => n + r.active_seconds, 0),
      last_beat_at: todayRow?.last_beat_at ?? null,
      streak_days: streakDays(present, opts.today),
      live: isLive(todayRow?.last_beat_at ?? null, opts.now),
      rank: 0,
    }
  })

  ranked.sort((a, b) => {
    if (b.week_seconds !== a.week_seconds) return b.week_seconds - a.week_seconds
    return (a.full_name ?? '').localeCompare(b.full_name ?? '', 'es')
  })
  ranked.forEach((m, i) => { m.rank = i + 1 })
  return ranked
}
