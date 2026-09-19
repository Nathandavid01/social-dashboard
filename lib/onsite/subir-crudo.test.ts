import { describe, expect, it } from 'vitest'
import {
  canResolveSessionTarget,
  pickTodaySession,
  todaySessionCreateValues,
  todaySessionsForClient,
} from './subir-crudo'

const s = (over: { id: string; clientId: string | null; date: string }) => over

describe('todaySessionsForClient', () => {
  const sessions = [
    s({ id: 'hoy-blue', clientId: 'c1', date: '2026-09-19' }),
    s({ id: 'hoy-otro', clientId: 'c2', date: '2026-09-19' }),
    s({ id: 'ayer-blue', clientId: 'c1', date: '2026-09-18' }),
    s({ id: 'sin', clientId: null, date: '2026-09-19' }),
  ]

  it('solo devuelve las sesiones de ese cliente en el día de hoy', () => {
    expect(todaySessionsForClient(sessions, 'c1', '2026-09-19').map((x) => x.id)).toEqual(['hoy-blue'])
  })

  it('sin cliente no inventa sesiones', () => {
    expect(todaySessionsForClient(sessions, '', '2026-09-19')).toEqual([])
  })
})

describe('pickTodaySession', () => {
  it('si hay una sola de hoy, la elige sola', () => {
    expect(pickTodaySession([{ id: 's1' }])).toEqual({ id: 's1' })
  })

  it('si hay varias, el usuario elige — no adivina', () => {
    expect(pickTodaySession([{ id: 'a' }, { id: 'b' }])).toBeNull()
  })

  it('si no hay, se crea al subir', () => {
    expect(pickTodaySession([])).toBeNull()
  })
})

describe('todaySessionCreateValues', () => {
  it('escribe la sesión de hoy con el nombre del cliente, sin lugar ni videógrafo', () => {
    expect(todaySessionCreateValues({
      clientId: 'c1',
      clientName: 'Blue Chiropractic',
      today: '2026-09-19',
    })).toEqual({
      session_date: '2026-09-19',
      client_id: 'c1',
      title: 'Blue Chiropractic',
    })
  })

  it('si el nombre viene vacío, usa Grabación', () => {
    expect(todaySessionCreateValues({
      clientId: 'c1',
      clientName: '  ',
      today: '2026-09-19',
    }).title).toBe('Grabación')
  })
})

describe('canResolveSessionTarget', () => {
  it('con sesión elegida o auto, sí', () => {
    expect(canResolveSessionTarget({ todaySessionCount: 2, sessionId: 's1', canCreateSession: false })).toBe(true)
  })

  it('sin sesiones de hoy, solo si puede crear', () => {
    expect(canResolveSessionTarget({ todaySessionCount: 0, sessionId: '', canCreateSession: true })).toBe(true)
    expect(canResolveSessionTarget({ todaySessionCount: 0, sessionId: '', canCreateSession: false })).toBe(false)
  })

  it('con varias de hoy y ninguna elegida, no crea otra', () => {
    expect(canResolveSessionTarget({ todaySessionCount: 2, sessionId: '', canCreateSession: true })).toBe(false)
  })
})
