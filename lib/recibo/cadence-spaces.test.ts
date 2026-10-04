import { describe, expect, it } from 'vitest'
import {
  applyEntregasReviewStatus,
  buildReciboCadenceSpaces,
  occupyingVideo,
  reciboMonthlyUploadCounts,
  reciboOccupancyIdeas,
  reciboSpaceTone,
  reciboVisibleAiClients,
  reviewStatusByIdea,
  type ReciboSpaceIdea,
} from './cadence-spaces'
import { ERIC_IDS } from './upload-counts'

const WEEK = { desde: '2026-09-28', hasta: '2026-10-04' } // lun–dom
const TODAY = '2026-10-04'

function video(over: Record<string, unknown> = {}) {
  return {
    id: 'v1',
    kind: 'edited',
    status: 'uploaded',
    storage_provider: 'entregas-r2',
    drive_file_id: 'key',
    uploaded_at: '2026-10-02T15:00:00Z',
    uploaded_by: null,
    ...over,
  }
}

function idea(over: Partial<ReciboSpaceIdea> = {}): ReciboSpaceIdea {
  return {
    id: 'i1',
    client_id: 'ai',
    status: 'producida',
    published_at: null,
    manual_posted_status: null,
    metricool_post_id: null,
    posted_at: null,
    staff_client_approval: null,
    client_review_status: null,
    entregas_review_status: null,
    publish_date: null,
    created_at: '2026-10-01T12:00:00Z',
    videos: [video()],
    ...over,
  }
}

describe('reciboOccupancyIdeas', () => {
  it('incluye crudo, corte y subida de cliente AI; deja fuera descartada y sin archivo', () => {
    const raw = idea({ id: 'raw', videos: [video({ kind: 'raw', id: 'r' })] })
    const edited = idea({ id: 'cut' })
    const empty = idea({ id: 'bare', videos: [] })
    const discarded = idea({ id: 'out', status: 'descartada' })
    const ids = reciboOccupancyIdeas([raw, edited, empty, discarded], ['ai']).map((row) => row.id)
    expect(ids).toEqual(['raw', 'cut'])
  })

  it('cuenta lo ya publicado o agendado — sirve al mes, no a la cola de publicar', () => {
    const published = idea({ id: 'pub', status: 'publicada', published_at: '2026-10-01T10:00:00Z' })
    const scheduled = idea({ id: 'sch', metricool_post_id: 9, posted_at: '2026-10-02T10:00:00Z' })
    expect(reciboOccupancyIdeas([published, scheduled], ['ai']).map((row) => row.id)).toEqual(['pub', 'sch'])
  })

  it('en cliente humano solo cuenta el corte editado de Eric, no el crudo', () => {
    const [eric] = [...ERIC_IDS]
    const deEricRaw = idea({
      id: 'eric-raw',
      client_id: 'human',
      videos: [video({ kind: 'raw', uploaded_by: eric })],
    })
    const deEricCut = idea({
      id: 'eric-cut',
      client_id: 'human',
      videos: [video({ kind: 'edited', uploaded_by: eric })],
    })
    const deAlexa = idea({
      id: 'alexa',
      client_id: 'human',
      videos: [video({ kind: 'edited', uploaded_by: 'alexa' })],
    })
    expect(reciboOccupancyIdeas([deEricRaw, deEricCut, deAlexa], ['ai']).map((row) => row.id)).toEqual(['eric-cut'])
  })
})

describe('reciboSpaceTone', () => {
  it('verde si el cliente o el staff ya aprobó', () => {
    expect(reciboSpaceTone(idea({ staff_client_approval: 'approved' }))).toBe('approved')
    expect(reciboSpaceTone(idea({ client_review_status: 'approved' }))).toBe('approved')
    expect(reciboSpaceTone(idea({ entregas_review_status: 'approved' }))).toBe('approved')
  })

  it('verde si ya está publicado o programado en Metricool', () => {
    expect(reciboSpaceTone(idea({ published_at: '2026-10-01T00:00:00Z' }))).toBe('approved')
    expect(reciboSpaceTone(idea({ metricool_post_id: 3 }))).toBe('approved')
  })

  it('ámbar si sigue pendiente o en borrador', () => {
    expect(reciboSpaceTone(idea())).toBe('pending')
    expect(reciboSpaceTone(idea({ manual_posted_status: 'not_posted' }))).toBe('pending')
  })
})

describe('buildReciboCadenceSpaces', () => {
  it('crea N espacios vacíos según los días de cadencia de esta semana', () => {
    const spaces = buildReciboCadenceSpaces({
      postingDays: [1, 3, 5],
      ideas: [],
      occupancyIdeas: [],
      week: WEEK,
    })
    expect(spaces).toHaveLength(3)
    expect(spaces.every((space) => space.kind === 'empty')).toBe(true)
    expect(spaces.map((space) => space.dateISO)).toEqual(['2026-09-28', '2026-09-30', '2026-10-02'])
  })

  it('llena espacios con los videos subidos y deja el resto pendiente', () => {
    const spaces = buildReciboCadenceSpaces({
      postingDays: [1, 3, 5],
      ideas: [idea({ id: 'a' }), idea({ id: 'b' })],
      occupancyIdeas: [idea({ id: 'a' }), idea({ id: 'b' })],
      week: WEEK,
    })
    expect(spaces.map((space) => space.kind)).toEqual(['occupied', 'occupied', 'empty'])
    expect(spaces.filter((space) => space.kind === 'occupied').map((space) => space.idea.id)).toEqual(['a', 'b'])
    expect(spaces[2]).toMatchObject({ kind: 'empty', label: 'Pendiente' })
  })

  it('sin cadencia no inventa huecos: solo muestra los videos reales', () => {
    const spaces = buildReciboCadenceSpaces({
      postingDays: [],
      ideas: [idea({ id: 'solo' })],
      occupancyIdeas: [idea({ id: 'solo' })],
      week: WEEK,
    })
    expect(spaces).toHaveLength(1)
    expect(spaces[0]).toMatchObject({ kind: 'occupied', idea: { id: 'solo' } })
  })

  it('no esconde el overflow si hay más videos que cupos', () => {
    const ideas = [idea({ id: '1' }), idea({ id: '2' }), idea({ id: '3' })]
    const spaces = buildReciboCadenceSpaces({
      postingDays: [1],
      ideas,
      occupancyIdeas: ideas,
      week: WEEK,
    })
    expect(spaces).toHaveLength(3)
    expect(spaces.every((space) => space.kind === 'occupied')).toBe(true)
  })

  it('un publicado o agendado de esta semana ocupa cupo y no vuelve a la cola', () => {
    const queue = [idea({ id: 'cola' })]
    const occupancy = [
      idea({ id: 'cola' }),
      idea({
        id: 'pub',
        status: 'publicada',
        published_at: '2026-10-01T18:00:00Z',
        publish_date: '2026-10-01',
      }),
    ]
    const spaces = buildReciboCadenceSpaces({
      postingDays: [1, 3, 5],
      ideas: queue,
      occupancyIdeas: occupancy,
      week: WEEK,
    })
    expect(spaces.map((space) => space.kind)).toEqual(['occupied', 'empty'])
    expect(spaces[0]).toMatchObject({ kind: 'occupied', idea: { id: 'cola' } })
  })

  it('sin padEmpty no inventa huecos: un corte de Eric en cliente humano no abre cupo semanal', () => {
    const spaces = buildReciboCadenceSpaces({
      postingDays: [1, 3, 5],
      ideas: [idea({ id: 'eric-cut', client_id: 'human' })],
      occupancyIdeas: [idea({ id: 'eric-cut', client_id: 'human' })],
      week: WEEK,
      padEmpty: false,
    })
    expect(spaces).toHaveLength(1)
    expect(spaces[0]).toMatchObject({ kind: 'occupied', idea: { id: 'eric-cut' } })
  })

  it('un raw ocupa espacio aunque todavía no haya corte', () => {
    const raw = idea({ id: 'crudo', videos: [video({ kind: 'raw', id: 'r1' })] })
    const spaces = buildReciboCadenceSpaces({
      postingDays: [1, 3],
      ideas: [raw],
      occupancyIdeas: [raw],
      week: WEEK,
    })
    expect(spaces[0]).toMatchObject({ kind: 'occupied', idea: { id: 'crudo' }, tone: 'pending' })
    expect(spaces[1].kind).toBe('empty')
  })
})

describe('reciboMonthlyUploadCounts', () => {
  it('agrupa por mes de subida, destaca el mes actual y omite meses viejos vacíos', () => {
    const october = idea({
      id: 'oct',
      videos: [video({ uploaded_at: '2026-10-02T12:00:00Z' })],
    })
    const september = idea({
      id: 'sep',
      videos: [video({ id: 'v2', uploaded_at: '2026-09-10T12:00:00Z' })],
    })
    const anotherOctober = idea({
      id: 'oct2',
      videos: [video({ id: 'v3', uploaded_at: '2026-10-03T12:00:00Z' })],
    })
    const counts = reciboMonthlyUploadCounts([october, september, anotherOctober], TODAY)
    expect(counts.total).toBe(3)
    expect(counts.months.map((month) => ({ key: month.key, count: month.count, current: month.current }))).toEqual([
      { key: '2026-10', count: 2, current: true },
      { key: '2026-09', count: 1, current: false },
    ])
    expect(counts.months[0].label).toMatch(/octubre/i)
    expect(counts.months[1].label).toMatch(/septiembre/i)
  })

  it('el mes actual aparece aunque no haya subidas — el cero sale de los datos, no se inventa otro mes', () => {
    const september = idea({
      id: 'sep',
      videos: [video({ uploaded_at: '2026-09-04T12:00:00Z' })],
    })
    const counts = reciboMonthlyUploadCounts([september], TODAY)
    expect(counts.total).toBe(1)
    expect(counts.months[0]).toMatchObject({ key: '2026-10', count: 0, current: true })
    expect(counts.months[1]).toMatchObject({ key: '2026-09', count: 1, current: false })
  })

  it('no cuenta una idea sin archivo usable', () => {
    const counts = reciboMonthlyUploadCounts([idea({ videos: [] })], TODAY)
    expect(counts.total).toBe(0)
    expect(counts.months).toEqual([{ key: '2026-10', count: 0, current: true, label: expect.stringMatching(/octubre/i) }])
  })
})

describe('reciboVisibleAiClients', () => {
  it('saca de la columna vacía a Aníbal, Arasibo, VSS y Primer Round', () => {
    const rows = [
      { id: '165b8416-5316-43e1-b6d6-f23caaa57b0c', name: 'Aníbal' },
      { id: 'ai', name: 'Arecibo Lab' },
    ]
    expect(reciboVisibleAiClients(rows).map((row) => row.id)).toEqual(['ai'])
  })
})

describe('applyEntregasReviewStatus', () => {
  it('pinta el voto de /aprobacion que vive en entregas_client_review_items, no en content_ideas', () => {
    const byIdea = reviewStatusByIdea([
      { idea_id: 'i1', status: 'approved' },
      { idea_id: 'i1', status: 'pending' },
    ])
    const [hydrated] = applyEntregasReviewStatus([idea()], byIdea)
    expect(hydrated.entregas_review_status).toBe('approved')
    expect(reciboSpaceTone(hydrated)).toBe('approved')
  })
})

describe('occupyingVideo', () => {
  it('prefiere el corte editado y si no hay, usa el crudo más reciente', () => {
    expect(occupyingVideo(idea())?.kind).toBe('edited')
    expect(
      occupyingVideo(
        idea({
          videos: [
            video({ id: 'old', kind: 'raw', uploaded_at: '2026-09-01T00:00:00Z' }),
            video({ id: 'new', kind: 'raw', uploaded_at: '2026-10-01T00:00:00Z' }),
          ],
        }),
      )?.id,
    ).toBe('new')
  })
})
