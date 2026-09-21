import { describe, expect, it } from 'vitest'
import { buildRecordingHoyGaps, type HoyGapIdea, type HoyGapSession } from './recording-hoy-gaps'

const TODAY = '2026-09-21'

function session(over: Partial<HoyGapSession> & { id: string }): HoyGapSession {
  return {
    title: over.title ?? 'Sesión',
    session_date: over.session_date ?? TODAY,
    status: over.status ?? 'scheduled',
    client_id: over.client_id === undefined ? 'c1' : over.client_id,
    videographer_id: over.videographer_id === undefined ? 'v1' : over.videographer_id,
    start_time: over.start_time === undefined ? '09:00' : over.start_time,
    client: over.client === undefined ? { name: 'Blue', posting_days: [1] } : over.client,
    ...over,
  }
}

function idea(over: Partial<HoyGapIdea> & { id: string }): HoyGapIdea {
  return {
    client_id: over.client_id ?? 'c1',
    recording_session_id: over.recording_session_id ?? 's1',
    status: over.status ?? 'idea',
    title: over.title ?? 'Idea',
    ...over,
  }
}

describe('buildRecordingHoyGaps', () => {
  it('unconfirmed = falta cliente O videógrafo O hora, desde hoy en adelante', () => {
    const gaps = buildRecordingHoyGaps(
      [
        session({ id: 'ok' }),
        session({ id: 'no-client', client_id: null, client: null }),
        session({ id: 'no-video', videographer_id: null }),
        session({ id: 'no-hora', start_time: '  ' }),
        session({ id: 'ayer', session_date: '2026-09-20', client_id: null, client: null }),
        session({ id: 'done', status: 'completed', videographer_id: null }),
        session({ id: 'cancel', status: 'cancelled', start_time: null }),
      ],
      [],
      TODAY,
    )
    expect(gaps.unconfirmed.map((s) => s.id)).toEqual(['no-client', 'no-hora', 'no-video'])
    expect(gaps.unconfirmed.find((s) => s.id === 'no-client')?.missing).toEqual(['cliente'])
    expect(gaps.unconfirmed.find((s) => s.id === 'no-video')?.missing).toEqual(['videografo'])
    expect(gaps.unconfirmed.find((s) => s.id === 'no-hora')?.missing).toEqual(['hora'])
  })

  it('SIN VIDEO = videógrafo vacío en los próximos 7 días (PR)', () => {
    const gaps = buildRecordingHoyGaps(
      [
        session({ id: 'hoy', videographer_id: null }),
        session({ id: 'dia7', session_date: '2026-09-28', videographer_id: '' }),
        session({ id: 'dia8', session_date: '2026-09-29', videographer_id: null }),
        session({ id: 'con-video', videographer_id: 'v1' }),
        session({ id: 'pasada', session_date: '2026-09-20', videographer_id: null }),
      ],
      [],
      TODAY,
    )
    expect(gaps.sinVideo.map((s) => s.id)).toEqual(['hoy', 'dia7'])
  })

  it('ideas shortfall only when posting_days already yields a slotTarget', () => {
    const enough = Array.from({ length: 6 }, (_, i) => idea({ id: `i${i}`, recording_session_id: 'full' }))
    const gaps = buildRecordingHoyGaps(
      [
        session({ id: 'short', title: 'Corto' }),
        session({ id: 'full' }),
        session({ id: 'no-meta', client: { name: 'X', posting_days: [] } }),
        session({ id: 'sin-cliente', client_id: null, client: null }),
      ],
      [idea({ id: 'one', recording_session_id: 'short' }), ...enough],
      TODAY,
    )
    expect(gaps.ideasShortfall.map((s) => s.id)).toEqual(['short'])
    expect(gaps.ideasShortfall[0]).toMatchObject({ ideaCount: 1, slotTarget: 6 })
  })

  it('badge actionableCount = unique unconfirmed ∪ SIN VIDEO, not ideas', () => {
    const gaps = buildRecordingHoyGaps(
      [
        session({ id: 'both', videographer_id: null, start_time: null }),
        session({ id: 'only-hora', start_time: null }),
        session({ id: 'later-video', session_date: '2026-09-25', videographer_id: null, start_time: '10:00' }),
        session({ id: 'ideas-only' }),
      ],
      [],
      TODAY,
    )
    expect(gaps.ideasShortfall.some((s) => s.id === 'ideas-only')).toBe(true)
    expect(gaps.actionableCount).toBe(3)
    expect(gaps.actionableIds).toEqual(['both', 'only-hora', 'later-video'])
  })

  it('uses the client name when present', () => {
    const gaps = buildRecordingHoyGaps(
      [session({ id: 's', client_id: null, client: null, title: 'Casita' })],
      [],
      TODAY,
    )
    expect(gaps.unconfirmed[0].title).toBe('Casita')
  })
})
