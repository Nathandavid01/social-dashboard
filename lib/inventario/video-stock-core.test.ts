import { describe, expect, it } from 'vitest'
import {
  buildVideoStock,
  classifyStockIdea,
  runOutDate,
  type StockClient,
  type StockIdea,
} from './video-stock-core'

const raw = (over: Partial<NonNullable<StockIdea['videos']>[number]> = {}) => ({
  kind: 'raw',
  status: 'uploaded',
  uploaded_at: '2026-10-08T12:00:00Z',
  ...over,
})
const edited = (over: Partial<NonNullable<StockIdea['videos']>[number]> = {}) => ({
  kind: 'edited',
  status: 'uploaded',
  uploaded_at: '2026-10-09T12:00:00Z',
  ...over,
})

function idea(over: Partial<StockIdea> = {}): StockIdea {
  return { id: 'i', client_id: 'c1', status: 'idea', videos: [], ...over }
}

describe('classifyStockIdea', () => {
  it('ignores discarded ideas', () => {
    expect(classifyStockIdea(idea({ status: 'descartada', videos: [edited()] }))).toBeNull()
  })

  it('counts a cut that already left (published, scheduled or posted) as salió — not as a video left', () => {
    expect(classifyStockIdea(idea({ status: 'producida', videos: [edited()], metricool_post_id: 123 }))).toBe('salio')
    expect(classifyStockIdea(idea({ status: 'producida', videos: [edited()], posted_at: '2026-10-01T00:00:00Z' }))).toBe('salio')
    expect(classifyStockIdea(idea({ status: 'producida', videos: [edited()], manual_posted_status: 'posted' }))).toBe('salio')
    expect(classifyStockIdea(idea({ status: 'publicada' }))).toBe('salio')
    expect(classifyStockIdea(idea({ status: 'producida', published_at: '2026-10-01T00:00:00Z' }))).toBe('salio')
  })

  it('an edited cut that has not left is listo', () => {
    expect(classifyStockIdea(idea({ status: 'producida', videos: [raw(), edited()] }))).toBe('listo')
  })

  it('archived or failed cuts do not count as listo', () => {
    expect(classifyStockIdea(idea({ status: 'grabada', videos: [raw(), edited({ status: 'archived' })] }))).toBe('crudo')
    expect(classifyStockIdea(idea({ status: 'grabada', videos: [raw(), edited({ status: 'failed' })] }))).toBe('crudo')
  })

  it('raw or b-roll footage with no cut is crudo (a grabación waiting to be edited)', () => {
    expect(classifyStockIdea(idea({ status: 'grabada', videos: [raw()] }))).toBe('crudo')
    expect(classifyStockIdea(idea({ status: 'idea', videos: [raw({ kind: 'broll' })] }))).toBe('crudo')
  })

  it('archived raw does not count as crudo', () => {
    expect(classifyStockIdea(idea({ status: 'grabada', videos: [raw({ status: 'archived' })] }))).toBe('sin_archivo')
  })

  it('marked recorded/produced but with no file in the system is sin_archivo (footage lives elsewhere, e.g. Drive)', () => {
    expect(classifyStockIdea(idea({ status: 'grabada' }))).toBe('sin_archivo')
    expect(classifyStockIdea(idea({ status: 'producida' }))).toBe('sin_archivo')
  })

  it('ideas not shot yet are por_grabar', () => {
    expect(classifyStockIdea(idea({ status: 'idea' }))).toBe('por_grabar')
    expect(classifyStockIdea(idea({ status: 'asignada' }))).toBe('por_grabar')
  })
})

describe('runOutDate', () => {
  // 2026-10-14 is a Wednesday (JS weekday 3).
  it('walks the cadence days from today and returns the first day with no video', () => {
    // Mon/Wed/Fri, 2 videos: Wed 14 + Fri 16 covered → Mon 19 has nothing.
    expect(runOutDate([1, 3, 5], 2, '2026-10-14')).toBe('2026-10-19')
  })

  it('with zero videos the very next posting day is already empty', () => {
    expect(runOutDate([1, 3, 5], 0, '2026-10-14')).toBe('2026-10-14')
    expect(runOutDate([2], 0, '2026-10-14')).toBe('2026-10-20')
  })

  it('returns null when the client has no cadence', () => {
    expect(runOutDate([], 5, '2026-10-14')).toBeNull()
    expect(runOutDate(null, 5, '2026-10-14')).toBeNull()
  })

  it('ignores out-of-range and duplicated weekdays', () => {
    expect(runOutDate([3, 3, 9, -1], 1, '2026-10-14')).toBe('2026-10-21')
  })
})

describe('buildVideoStock', () => {
  const today = '2026-10-14'
  const clients: StockClient[] = [
    { id: 'c1', name: 'La Guira', posting_days: [1, 3, 5] },
    { id: 'c2', name: 'Apiario', posting_days: [2, 5] },
    { id: 'c3', name: 'Lenel', posting_days: [] },
    { id: 'c4', name: 'Vacío', posting_days: [1] },
  ]

  const ideas: StockIdea[] = [
    // La Guira: 1 listo, 2 crudo, 1 sin archivo, 1 por grabar, 1 salió
    idea({ id: 'a', client_id: 'c1', status: 'producida', videos: [edited()] }),
    idea({ id: 'b', client_id: 'c1', status: 'grabada', videos: [raw({ uploaded_at: '2026-09-28T10:00:00Z' })] }),
    idea({ id: 'c', client_id: 'c1', status: 'grabada', videos: [raw({ uploaded_at: '2026-10-02T10:00:00Z' })] }),
    idea({ id: 'd', client_id: 'c1', status: 'grabada' }),
    idea({ id: 'e', client_id: 'c1', status: 'idea' }),
    idea({ id: 'f', client_id: 'c1', status: 'producida', videos: [edited()], metricool_post_id: 9 }),
    // Apiario: 6 listos
    ...Array.from({ length: 6 }, (_, n) =>
      idea({ id: `ap${n}`, client_id: 'c2', status: 'producida', videos: [edited()] }),
    ),
    // Lenel: no cadence, 3 listos
    ...Array.from({ length: 3 }, (_, n) =>
      idea({ id: `le${n}`, client_id: 'c3', status: 'producida', videos: [edited()] }),
    ),
    // An idea from a client that is not active must be ignored
    idea({ id: 'z', client_id: 'gone', status: 'producida', videos: [edited()] }),
  ]

  const stock = buildVideoStock(clients, ideas, today)
  const byId = Object.fromEntries(stock.clients.map((c) => [c.clientId, c]))

  it('counts each bucket per client', () => {
    expect(byId.c1).toMatchObject({ listos: 1, crudo: 2, sinArchivo: 1, porGrabar: 1, salieron: 1, perWeek: 3 })
    expect(byId.c2).toMatchObject({ listos: 6, crudo: 0, perWeek: 2 })
  })

  it('remembers the latest raw upload so you know when they last recorded', () => {
    expect(byId.c1.lastRawAt).toBe('2026-10-02T10:00:00Z')
    expect(byId.c2.lastRawAt).toBeNull()
  })

  it('turns videos left into days of content and the run-out date', () => {
    // daysLeft = days until the run-out date (contract changed in this PR,
    // 2026-10-14, Eric asked for reels vs posts per cadence day: an average
    // count/perWeek can't express "the reels last but the posts don't").
    // 1 listo, Mon/Wed/Fri, today Wed 14 → Wed covered, runs out Fri 16.
    expect(byId.c1.runOutDate).toBe('2026-10-16')
    expect(byId.c1.daysLeft).toBe(2)
    // 6 listos, Tue/Fri → covers through Tue Nov 3, runs out Fri Nov 6.
    expect(byId.c2.runOutDate).toBe('2026-11-06')
    expect(byId.c2.daysLeft).toBe(23)
  })

  it('rates health by days of edited content (videos que le quedan)', () => {
    expect(byId.c1.health).toBe('critico') // < 7 days
    expect(byId.c2.health).toBe('ok') // ≥ 14 days
    expect(byId.c3.health).toBe('sin_cadencia')
    expect(byId.c4.health).toBe('agotado') // cadence but 0 listos
  })

  it('flags who needs a recording: listos + crudo cover less than two weeks', () => {
    // La Guira: (1 + 2) / 3 per week = 1 week → needs recording.
    expect(byId.c1.necesitaGrabar).toBe(true)
    // Apiario: 6 / 2 = 3 weeks → fine.
    expect(byId.c2.necesitaGrabar).toBe(false)
    // No cadence → we cannot say.
    expect(byId.c3.necesitaGrabar).toBe(false)
    expect(byId.c4.necesitaGrabar).toBe(true)
  })

  it('ignores ideas from inactive / unknown clients', () => {
    expect(stock.clients.map((c) => c.clientId).sort()).toEqual(['c1', 'c2', 'c3', 'c4'])
    expect(stock.totals.listos).toBe(1 + 6 + 3)
  })

  it('sorts the most urgent first, no-cadence clients last', () => {
    expect(stock.clients.map((c) => c.clientId)).toEqual(['c4', 'c1', 'c2', 'c3'])
  })

  it('summarizes totals for the KPI tiles', () => {
    expect(stock.totals).toMatchObject({
      listos: 10,
      crudo: 2,
      sinArchivo: 1,
      clientesConCrudo: 1,
      necesitanGrabar: 2,
      sinCadencia: 1,
    })
  })
})

describe('scheduled posts still cover the cadence (review #248)', () => {
  const today = '2026-10-14'
  const client = { id: 'c1', name: 'Agendado', posting_days: [1, 3, 5] }
  const scheduled = (id: string, publish_date: string): StockIdea => ({
    id,
    client_id: 'c1',
    status: 'producida',
    metricool_post_id: 1,
    posted_at: '2026-10-10T12:00:00Z',
    publish_date,
    videos: [{ kind: 'edited', status: 'uploaded' }],
  })

  it('a cut scheduled for today or later is agendado, not salió', () => {
    expect(classifyStockIdea(scheduled('a', '2026-10-16'), today)).toBe('agendado')
    expect(classifyStockIdea(scheduled('a', '2026-10-14'), today)).toBe('agendado')
  })

  it('a scheduled cut whose date already passed (or has no date) already left', () => {
    expect(classifyStockIdea(scheduled('a', '2026-10-13'), today)).toBe('salio')
    expect(classifyStockIdea({ ...scheduled('a', ''), publish_date: null }, today)).toBe('salio')
  })

  it('a published cut is salió even if its planned date is in the future', () => {
    expect(classifyStockIdea({ ...scheduled('a', '2026-10-20'), published_at: '2026-10-12T00:00:00Z' }, today)).toBe('salio')
  })

  it('six scheduled posts and zero unscheduled cuts = two weeks covered, not "sin videos"', () => {
    const ideas = ['10-14', '10-16', '10-19', '10-21', '10-23', '10-26'].map((d, n) => scheduled(`s${n}`, `2026-${d}`))
    const [row] = buildVideoStock([client], ideas, today).clients
    expect(row).toMatchObject({ listos: 0, agendados: 6, health: 'ok', necesitaGrabar: false })
    expect(row.daysLeft).toBe(14)
    expect(row.runOutDate).toBe('2026-10-28')
  })
})


describe('client logo', () => {
  it('passes the logo url through, null when the client has none', () => {
    const stock = buildVideoStock(
      [
        { id: 'a', name: 'Con logo', posting_days: [1], logoUrl: '/api/img-proxy?u=x' },
        { id: 'b', name: 'Sin logo', posting_days: [1] },
      ],
      [],
      '2026-10-14',
    )
    const byId = Object.fromEntries(stock.clients.map((c) => [c.clientId, c]))
    expect(byId.a.logoUrl).toBe('/api/img-proxy?u=x')
    expect(byId.b.logoUrl).toBeNull()
  })
})

describe('reels vs posts per cadence day', () => {
  const today = '2026-10-14' // Wednesday
  const reel = (id: string): StockIdea => ({ id, client_id: 'c', status: 'producida', content_type: 'R', videos: [{ kind: 'edited', status: 'uploaded' }] })
  const post = (id: string): StockIdea => ({ id, client_id: 'c', status: 'producida', content_type: 'P', videos: [{ kind: 'edited', status: 'uploaded' }] })
  // Mon reel · Wed post · Fri reel
  const client: StockClient = { id: 'c', name: 'Mixto', posting_days: [1, 3, 5], formats: { 1: 'reel', 3: 'post', 5: 'reel' } }

  it('splits the ready videos into reels and posts', () => {
    const [row] = buildVideoStock([client], [reel('r1'), reel('r2'), post('p1')], today).clients
    expect(row).toMatchObject({ listos: 3, reels: 2, posts: 1 })
  })

  it('a reel cannot cover a post day: plenty of reels, no post → runs out today (Wed = post)', () => {
    const [row] = buildVideoStock([client], [reel('r1'), reel('r2'), reel('r3'), reel('r4')], today).clients
    expect(row.runOutDate).toBe('2026-10-14')
    expect(row.runOutFormat).toBe('post')
    expect(row.daysLeft).toBe(0)
  })

  it('matching formats walk the cadence day by day', () => {
    // Wed post ✓, Fri reel ✓, Mon reel ✓, Wed 21 post ✗
    const [row] = buildVideoStock([client], [post('p1'), reel('r1'), reel('r2'), reel('r3')], today).clients
    expect(row.runOutDate).toBe('2026-10-21')
    expect(row.runOutFormat).toBe('post')
  })

  it('a day with no known format takes whatever is ready', () => {
    const open: StockClient = { id: 'c', name: 'Abierto', posting_days: [3, 5] }
    const [row] = buildVideoStock([open], [post('p1'), reel('r1')], today).clients
    expect(row.runOutDate).toBe('2026-10-21')
    expect(row.runOutFormat).toBeNull()
  })
})

describe('scheduled posts only cover their own day (review #248, same model as the profile calendar)', () => {
  const today = '2026-10-14' // Wednesday
  const client: StockClient = { id: 'c', name: 'Agendado lejos', posting_days: [1, 3, 5] }
  const sched = (id: string, date: string): StockIdea => ({
    id, client_id: 'c', status: 'producida', metricool_post_id: 1, publish_date: date,
    videos: [{ kind: 'edited', status: 'uploaded' }],
  })

  it('three posts scheduled a month out do not cover this week', () => {
    const [row] = buildVideoStock([client], [sched('a', '2026-11-16'), sched('b', '2026-11-18'), sched('c', '2026-11-20')], today).clients
    expect(row.runOutDate).toBe('2026-10-14')
    expect(row.daysLeft).toBe(0)
  })

  it('a scheduled day is skipped by the walk, and ready cuts fill the others', () => {
    const ready: StockIdea = { id: 'r', client_id: 'c', status: 'producida', videos: [{ kind: 'edited', status: 'uploaded' }] }
    // Wed 14 scheduled, Fri 16 ← ready cut, Mon 19 empty.
    const [row] = buildVideoStock([client], [sched('a', '2026-10-14'), ready], today).clients
    expect(row.runOutDate).toBe('2026-10-19')
  })
})

describe('posts scheduled in Metricool (the planner, not only the dashboard)', () => {
  const today = '2026-10-14' // Wednesday
  const ready: StockIdea = { id: 'r', client_id: 'c', status: 'producida', videos: [{ kind: 'edited', status: 'uploaded' }] }

  it('each scheduled post covers its own day and counts as agendado', () => {
    const client: StockClient = {
      id: 'c', name: 'Planner', posting_days: [1, 3, 5],
      scheduled: [
        { id: 1, date: '2026-10-14', format: 'reel', title: 'a' },
        { id: 2, date: '2026-10-16', format: 'reel', title: 'b' },
      ],
    }
    // Wed + Fri scheduled, Mon 19 ← ready cut, Wed 21 empty.
    const [row] = buildVideoStock([client], [ready], today).clients
    expect(row.agendados).toBe(2)
    expect(row.runOutDate).toBe('2026-10-21')
  })

  it('a dashboard idea already linked to that Metricool post is not counted twice', () => {
    const client: StockClient = {
      id: 'c', name: 'Planner', posting_days: [1, 3, 5],
      scheduled: [{ id: 9, date: '2026-10-16', format: 'reel', title: 'x' }],
    }
    const linked: StockIdea = {
      id: 'l', client_id: 'c', status: 'producida', metricool_post_id: 9, publish_date: '2026-10-16',
      videos: [{ kind: 'edited', status: 'uploaded' }],
    }
    const [row] = buildVideoStock([client], [linked], today).clients
    expect(row.agendados).toBe(1)
  })
})
