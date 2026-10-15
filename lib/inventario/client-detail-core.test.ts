import { describe, expect, it } from 'vitest'
import { buildClientDetail, type DetailIdea } from './client-detail-core'

// 2026-10-14 is a Wednesday. Cadence Mon/Wed/Fri.
const today = '2026-10-14'
const MWF = [1, 3, 5]
const edited = (id = 'v') => ({ id, kind: 'edited', status: 'uploaded', uploaded_at: '2026-10-10T00:00:00Z' })

function idea(over: Partial<DetailIdea>): DetailIdea {
  return { id: 'x', title: 'Idea', status: 'producida', videos: [], ...over }
}

describe('buildClientDetail — calendar (next 14 days)', () => {
  it('lays out 14 days from today with the posting days marked', () => {
    const { calendar } = buildClientDetail([], MWF, today)
    expect(calendar).toHaveLength(14)
    expect(calendar[0]).toMatchObject({ date: '2026-10-14', weekday: 3, posting: true })
    expect(calendar[1]).toMatchObject({ date: '2026-10-15', weekday: 4, posting: false, kind: 'libre' })
    expect(calendar[13].date).toBe('2026-10-27')
  })

  it('a posting day with nothing is vacío', () => {
    const { calendar } = buildClientDetail([], MWF, today)
    expect(calendar.filter((d) => d.kind === 'vacio').map((d) => d.date)).toEqual([
      '2026-10-14', '2026-10-16', '2026-10-19', '2026-10-21', '2026-10-23', '2026-10-26',
    ])
  })

  it('a scheduled post sits on its publish date', () => {
    const { calendar } = buildClientDetail(
      [idea({ id: 'a', title: 'Reel terraza', metricool_post_id: 5, publish_date: '2026-10-16', videos: [edited()] })],
      MWF,
      today,
    )
    const fri = calendar.find((d) => d.date === '2026-10-16')!
    expect(fri).toMatchObject({ kind: 'agendado', postId: 'a', title: 'Reel terraza' })
  })

  it('unscheduled ready cuts fill the empty posting days in order (proyectado)', () => {
    const { calendar } = buildClientDetail(
      [
        idea({ id: 'a', metricool_post_id: 5, publish_date: '2026-10-14', videos: [edited()] }),
        idea({ id: 'l1', title: 'Listo 1', videos: [edited()] }),
        idea({ id: 'l2', title: 'Listo 2', videos: [edited()] }),
      ],
      MWF,
      today,
    )
    expect(calendar.filter((d) => d.posting).map((d) => [d.date, d.kind, d.postId])).toEqual([
      ['2026-10-14', 'agendado', 'a'],
      ['2026-10-16', 'proyectado', 'l1'],
      ['2026-10-19', 'proyectado', 'l2'],
      ['2026-10-21', 'vacio', null],
      ['2026-10-23', 'vacio', null],
      ['2026-10-26', 'vacio', null],
    ])
  })

  it('a post published today shows as publicado', () => {
    const { calendar } = buildClientDetail(
      [idea({ id: 'p', status: 'publicada', published_at: '2026-10-14T15:00:00Z', videos: [edited()] })],
      MWF,
      today,
    )
    expect(calendar[0]).toMatchObject({ kind: 'publicado', postId: 'p' })
  })

  it('without cadence there are no posting days, only what is dated', () => {
    const { calendar } = buildClientDetail(
      [idea({ id: 'a', metricool_post_id: 5, publish_date: '2026-10-15', videos: [edited()] })],
      [],
      today,
    )
    expect(calendar.some((d) => d.posting)).toBe(false)
    expect(calendar[1]).toMatchObject({ kind: 'agendado', postId: 'a' })
  })
})

describe('buildClientDetail — posts list', () => {
  const ideas = [
    idea({ id: 'old', title: 'Viejo', status: 'publicada', published_at: '2026-09-01T00:00:00Z', videos: [edited('v0')] }),
    idea({ id: 'pub', title: 'Publicado ayer', status: 'publicada', published_at: '2026-10-13T12:00:00Z', videos: [edited('v1')] }),
    idea({ id: 'ag', title: 'Agendado', metricool_post_id: 3, publish_date: '2026-10-19', videos: [edited('v2')] }),
    idea({ id: 'li', title: 'Listo', videos: [edited('v3')] }),
    idea({ id: 'cr', title: 'Crudo', status: 'grabada', videos: [{ id: 'v4', kind: 'raw', status: 'uploaded' }] }),
    idea({ id: 'dis', title: 'Descartado', status: 'descartada', videos: [edited('v5')] }),
  ]
  const detail = buildClientDetail(ideas, MWF, today)

  it('upcoming = scheduled by date, then ready cuts with the day they would go out', () => {
    expect(detail.upcoming.map((p) => [p.id, p.stage, p.date])).toEqual([
      ['ag', 'agendado', '2026-10-19'],
      ['li', 'listo', '2026-10-14'],
    ])
  })

  it('upcoming carries the edited video id for the cover', () => {
    expect(detail.upcoming[0].coverVideoId).toBe('v2')
  })

  it('recent = published in the last 30 days, newest first; discarded never shows', () => {
    expect(detail.recent.map((p) => p.id)).toEqual(['pub'])
    expect([...detail.upcoming, ...detail.recent].some((p) => p.id === 'dis')).toBe(false)
  })

  it('counts raw clips waiting', () => {
    expect(detail.crudo).toBe(1)
  })
})

describe('buildClientDetail — reels vs posts', () => {
  // Mon reel · Wed post · Fri reel
  const formats = { 1: 'reel', 3: 'post', 5: 'reel' } as const
  const reel = (id: string) => idea({ id, title: `Reel ${id}`, content_type: 'R', videos: [edited(id)] })
  const post = (id: string) => idea({ id, title: `Post ${id}`, content_type: 'P', videos: [edited(id)] })

  it('each posting day says which format it takes', () => {
    const { calendar } = buildClientDetail([], MWF, today, formats)
    expect(calendar.filter((d) => d.posting).map((d) => [d.date, d.format])).toEqual([
      ['2026-10-14', 'post'], ['2026-10-16', 'reel'], ['2026-10-19', 'reel'],
      ['2026-10-21', 'post'], ['2026-10-23', 'reel'], ['2026-10-26', 'reel'],
    ])
  })

  it('a ready reel only fills reel days and a ready post only post days', () => {
    const { calendar } = buildClientDetail([reel('r1'), reel('r2'), post('p1')], MWF, today, formats)
    expect(calendar.filter((d) => d.posting).map((d) => [d.date, d.kind, d.postId])).toEqual([
      ['2026-10-14', 'proyectado', 'p1'],
      ['2026-10-16', 'proyectado', 'r1'],
      ['2026-10-19', 'proyectado', 'r2'],
      ['2026-10-21', 'vacio', null],
      ['2026-10-23', 'vacio', null],
      ['2026-10-26', 'vacio', null],
    ])
  })

  it('every post carries its format so the panel can split reels from posts', () => {
    const { upcoming } = buildClientDetail([reel('r1'), post('p1')], MWF, today, formats)
    expect(upcoming.map((p) => [p.id, p.format])).toEqual([
      ['r1', 'reel'],
      ['p1', 'post'],
    ])
  })
})
