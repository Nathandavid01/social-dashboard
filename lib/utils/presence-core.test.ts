import { describe, it, expect } from 'vitest'
import {
  PRESENCE_IDLE_MS,
  PRESENCE_LIVE_MS,
  JORNADA_TARGET_SECONDS,
  applyHeartbeat,
  formatDuration,
  streakDays,
  weekStartMonday,
  isLive,
  jornadaProgress,
  rankMembers,
  type PresenceDayRow,
} from './presence-core'

describe('applyHeartbeat', () => {
  const t0 = new Date('2026-08-16T14:00:00.000Z')

  it('primer latido del día: no suma tiempo, solo marca last_beat', () => {
    const out = applyHeartbeat(null, t0)
    expect(out.secondsAdded).toBe(0)
    expect(out.active_seconds).toBe(0)
    expect(out.last_beat_at).toBe(t0.toISOString())
  })

  it('latido a 60s: suma esos 60 segundos', () => {
    const prev = { last_beat_at: t0.toISOString(), active_seconds: 0 }
    const out = applyHeartbeat(prev, new Date(t0.getTime() + 60_000))
    expect(out.secondsAdded).toBe(60)
    expect(out.active_seconds).toBe(60)
  })

  it('hueco mayor al idle: no suma (se fue y volvió)', () => {
    const prev = { last_beat_at: t0.toISOString(), active_seconds: 120 }
    const out = applyHeartbeat(prev, new Date(t0.getTime() + PRESENCE_IDLE_MS + 1_000))
    expect(out.secondsAdded).toBe(0)
    expect(out.active_seconds).toBe(120)
  })

  it('hueco justo en el idle: todavía cuenta', () => {
    const prev = { last_beat_at: t0.toISOString(), active_seconds: 0 }
    const out = applyHeartbeat(prev, new Date(t0.getTime() + PRESENCE_IDLE_MS))
    expect(out.secondsAdded).toBe(PRESENCE_IDLE_MS / 1000)
  })

  it('reloj hacia atrás: no resta ni suma', () => {
    const prev = { last_beat_at: t0.toISOString(), active_seconds: 90 }
    const out = applyHeartbeat(prev, new Date(t0.getTime() - 5_000))
    expect(out.secondsAdded).toBe(0)
    expect(out.active_seconds).toBe(90)
    expect(out.last_beat_at).toBe(t0.toISOString())
  })

  it('PRESENCE_IDLE_MS es 3 minutos', () => {
    expect(PRESENCE_IDLE_MS).toBe(180_000)
  })
})

describe('formatDuration', () => {
  it('formatea minutos, horas y mixto', () => {
    expect(formatDuration(0)).toBe('0m')
    expect(formatDuration(45)).toBe('0m')
    expect(formatDuration(45 * 60)).toBe('45m')
    expect(formatDuration(3600)).toBe('1h')
    expect(formatDuration(8010)).toBe('2h 13m')
    expect(formatDuration(59)).toBe('0m')
  })
})

describe('streakDays', () => {
  it('cuenta hacia atrás desde hoy si hoy tiene tiempo', () => {
    expect(streakDays(new Set(['2026-08-16', '2026-08-15', '2026-08-14']), '2026-08-16')).toBe(3)
  })
  it('si hoy todavía va en 0, la racha no se rompe (cuenta desde ayer)', () => {
    expect(streakDays(new Set(['2026-08-15', '2026-08-14']), '2026-08-16')).toBe(2)
  })
  it('un hueco corta la racha', () => {
    expect(streakDays(new Set(['2026-08-16', '2026-08-14']), '2026-08-16')).toBe(1)
  })
  it('sin días: 0', () => {
    expect(streakDays(new Set(), '2026-08-16')).toBe(0)
  })
})

describe('weekStartMonday', () => {
  it('domingo 16 ago 2026 → lunes 10', () => {
    expect(weekStartMonday('2026-08-16')).toBe('2026-08-10')
  })
  it('lunes se queda en sí mismo', () => {
    expect(weekStartMonday('2026-08-10')).toBe('2026-08-10')
  })
})

describe('isLive / jornadaProgress', () => {
  const now = new Date('2026-08-16T15:00:00.000Z')
  it('en vivo si el último latido es reciente', () => {
    expect(isLive(new Date(now.getTime() - 30_000).toISOString(), now)).toBe(true)
    expect(isLive(new Date(now.getTime() - PRESENCE_LIVE_MS - 1).toISOString(), now)).toBe(false)
    expect(isLive(null, now)).toBe(false)
  })
  it('jornada de 4h: 2h es 0.5; nunca pasa de 1', () => {
    expect(JORNADA_TARGET_SECONDS).toBe(4 * 3600)
    expect(jornadaProgress(2 * 3600)).toBe(0.5)
    expect(jornadaProgress(10 * 3600)).toBe(1)
    expect(jornadaProgress(0)).toBe(0)
  })
})

describe('rankMembers', () => {
  const rows: PresenceDayRow[] = [
    { user_id: 'a', day: '2026-08-16', active_seconds: 100, last_beat_at: '2026-08-16T15:00:00.000Z' },
    { user_id: 'b', day: '2026-08-16', active_seconds: 500, last_beat_at: null },
    { user_id: 'a', day: '2026-08-15', active_seconds: 200, last_beat_at: null },
  ]
  const people = [
    { id: 'a', full_name: 'Ana', avatar_url: null },
    { id: 'b', full_name: 'Beto', avatar_url: null },
    { id: 'c', full_name: 'Cora', avatar_url: null },
  ]

  it('ordena por tiempo de la semana, incluye a quien va en 0', () => {
    const ranked = rankMembers(people, rows, {
      today: '2026-08-16',
      weekStart: '2026-08-10',
      now: new Date('2026-08-16T15:00:30.000Z'),
    })
    expect(ranked.map((m) => m.user_id)).toEqual(['b', 'a', 'c'])
    expect(ranked[0].week_seconds).toBe(500)
    expect(ranked[0].today_seconds).toBe(500)
    expect(ranked[0].live).toBe(false)
    expect(ranked[1].week_seconds).toBe(300)
    expect(ranked[1].today_seconds).toBe(100)
    expect(ranked[1].live).toBe(true)
    expect(ranked[2].week_seconds).toBe(0)
    expect(ranked[0].rank).toBe(1)
  })
})
