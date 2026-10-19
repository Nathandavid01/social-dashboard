import { describe, expect, it } from 'vitest'
import {
  buildReciboPublishLookup,
  filterReciboIdeasByDay,
  formatReciboPublishAt,
  puertoRicoClock,
  reciboDayPresets,
  reciboVideosForDay,
  resolveReciboPublishAt,
  sortReciboIdeasByPublishTime,
  type ReciboDayCadence,
  type ReciboDayIdea,
} from './day-queue'

const TODAY = '2026-10-19' // lunes en Puerto Rico
const TOMORROW = '2026-10-20' // martes

function video(over: Record<string, unknown> = {}) {
  return {
    id: 'v1',
    kind: 'edited',
    status: 'uploaded',
    storage_provider: 'entregas-r2',
    drive_file_id: 'key',
    mime_type: 'video/mp4',
    name: 'cut.mp4',
    uploaded_at: '2026-10-18T15:00:00Z',
    ...over,
  }
}

function idea(over: Partial<ReciboDayIdea> & { id: string }): ReciboDayIdea {
  return {
    client_id: 'lab',
    status: 'producida',
    published_at: null,
    manual_posted_status: null,
    metricool_post_id: null,
    posted_at: null,
    publish_date: null,
    created_at: '2026-10-18T12:00:00Z',
    videos: [video({ id: `v-${over.id}` })],
    client: { name: 'Arecibo Lab' },
    ...over,
  }
}

const labCadence: ReciboDayCadence = {
  postingDays: [2], // martes
  postingTime: '10:00',
}

const farmaciaCadence: ReciboDayCadence = {
  postingDays: [2],
  postingTime: '18:00',
}

describe('puertoRicoClock', () => {
  it('trata la medianoche de Puerto Rico como el día nuevo, no el UTC', () => {
    expect(puertoRicoClock('2026-10-20T04:00:00.000Z')).toEqual({ dayISO: '2026-10-20', timeHHMM: '00:00' })
    expect(puertoRicoClock('2026-10-20T03:59:00.000Z')).toEqual({ dayISO: '2026-10-19', timeHHMM: '23:59' })
  })

  it('no convierte una fecha YYYY-MM-DD como medianoche UTC', () => {
    expect(puertoRicoClock('2026-10-20')).toBeNull()
  })
})

describe('resolveReciboPublishAt', () => {
  it('usa publish_date como día de calendario y la hora de cadencia, sin inventar 10:00', () => {
    const at = resolveReciboPublishAt(
      idea({ id: 'dated', publish_date: '2026-10-20' }),
      labCadence,
    )
    expect(at).toMatchObject({
      source: 'publish_date',
      dayISO: '2026-10-20',
      timeHHMM: '10:00',
    })
    expect(at.sourceLabel).toBe('Fecha prevista')
    expect(formatReciboPublishAt(at)).toMatch(/martes 20 de octubre/i)
    expect(formatReciboPublishAt(at)).toMatch(/10:00 a\.m\./)
  })

  it('un YYYY-MM-DD no se desplaza al día anterior por UTC', () => {
    const at = resolveReciboPublishAt(
      idea({ id: 'utc-trap', publish_date: '2026-10-20' }),
      { postingTime: '18:00' },
    )
    expect(at.dayISO).toBe('2026-10-20')
    expect(at.dayISO).not.toBe('2026-10-19')
  })

  it('Metricool gana a publish_date y toma la hora del instante si cae el mismo día PR', () => {
    const at = resolveReciboPublishAt(
      idea({
        id: 'scheduled',
        publish_date: '2026-10-20',
        metricool_post_id: 88,
        posted_at: '2026-10-20T14:30:00.000Z', // 10:30 a.m. AST
      }),
      labCadence,
    )
    expect(at).toMatchObject({
      source: 'metricool',
      dayISO: '2026-10-20',
      timeHHMM: '10:30',
      sourceLabel: 'Programado en Metricool',
    })
  })

  it('si posted_at es justo antes de medianoche PR y no coincide con publish_date, no mueve el video de día', () => {
    const at = resolveReciboPublishAt(
      idea({
        id: 'booking',
        publish_date: '2026-10-20',
        metricool_post_id: 9,
        posted_at: '2026-10-20T03:59:00.000Z', // 19 oct 23:59 AST — marca de envío
      }),
      farmaciaCadence,
    )
    expect(at.source).toBe('metricool')
    expect(at.dayISO).toBe('2026-10-20')
    expect(at.timeHHMM).toBe('18:00')
  })

  it('programado sin publish_date no inventa el día con posted_at de envío', () => {
    const at = resolveReciboPublishAt(
      idea({
        id: 'no-day',
        metricool_post_id: 3,
        posted_at: '2026-10-20T14:00:00.000Z',
      }),
      labCadence,
    )
    expect(at).toMatchObject({ source: 'none', dayISO: null, timeHHMM: null })
    expect(formatReciboPublishAt(at)).toBe('Sin fecha de publicación')
  })

  it('sin fecha ni proyección queda sin fecha', () => {
    const at = resolveReciboPublishAt(idea({ id: 'undated' }), { postingDays: [], postingTime: null })
    expect(at.source).toBe('none')
    expect(at.dayISO).toBeNull()
  })

  it('sin hora de cadencia conserva el día y no inventa la hora', () => {
    const at = resolveReciboPublishAt(
      idea({ id: 'no-time', publish_date: '2026-10-20' }),
      { postingDays: [2], postingTime: null },
    )
    expect(at.dayISO).toBe('2026-10-20')
    expect(at.timeHHMM).toBeNull()
    expect(formatReciboPublishAt(at)).toMatch(/sin hora/i)
  })
})

describe('filter and sort by Puerto Rico day', () => {
  const cadenceByClient = { lab: labCadence, farm: farmaciaCadence }

  const morning = idea({
    id: 'morning',
    client_id: 'lab',
    publish_date: TOMORROW,
    client: { name: 'Arecibo Lab' },
  })
  const evening = idea({
    id: 'evening',
    client_id: 'farm',
    publish_date: TOMORROW,
    metricool_post_id: 12,
    posted_at: '2026-10-18T16:00:00.000Z',
    client: { name: 'Farmacia Buena Vida' },
    videos: [video({ id: 'v-evening' })],
  })
  const todayClip = idea({
    id: 'today',
    publish_date: TODAY,
    client: { name: 'Arecibo Lab' },
  })
  const undated = idea({
    id: 'undated',
    client: { name: 'Arecibo Lab' },
  })
  const midnight = idea({
    id: 'midnight',
    client_id: 'farm',
    publish_date: TOMORROW,
    metricool_post_id: 44,
    posted_at: '2026-10-20T04:00:00.000Z',
    client: { name: 'Farmacia Buena Vida' },
    videos: [video({ id: 'v-midnight' })],
  })

  const ideas = [evening, undated, morning, todayClip, midnight]
  const lookup = buildReciboPublishLookup(ideas, cadenceByClient, TODAY, { nowTime: '08:00' })

  it('filtra el día elegido y deja fuera los videos sin fecha', () => {
    const tomorrow = filterReciboIdeasByDay(ideas, TOMORROW, lookup)
    expect(tomorrow.map((row) => row.id)).toEqual(expect.arrayContaining(['morning', 'evening', 'midnight']))
    expect(tomorrow.map((row) => row.id)).not.toContain('undated')
    expect(tomorrow.map((row) => row.id)).not.toContain('today')
    expect(filterReciboIdeasByDay(ideas, TODAY, lookup).map((row) => row.id)).toEqual(['today'])
  })

  it('ordena por hora de Puerto Rico; sin hora al final', () => {
    const sorted = sortReciboIdeasByPublishTime(
      filterReciboIdeasByDay(ideas, TOMORROW, lookup),
      lookup,
    )
    expect(sorted.map((row) => row.id)).toEqual(['midnight', 'morning', 'evening'])
  })

  it('reciboVideosForDay une filtro, orden y excluye gráficas', () => {
    const graphic = idea({
      id: 'graphic',
      publish_date: TOMORROW,
      videos: [video({ id: 'g1', mime_type: 'image/png', name: 'post.png' })],
    })
    const queue = reciboVideosForDay([...ideas, graphic], TOMORROW, lookup)
    expect(queue.map((row) => row.id)).toEqual(['midnight', 'morning', 'evening'])
  })

  it('proyecta por cadencia un video sin fecha al próximo día compatible, sin inventar si no hay días', () => {
    const pending = idea({
      id: 'pending',
      created_at: '2026-10-17T12:00:00Z',
      videos: [video({ id: 'v-pending', mime_type: 'video/mp4', name: 'pending.mp4' })],
    })
    const withCadence = buildReciboPublishLookup(
      [pending],
      { lab: { postingDays: [2], postingTime: '11:00' } },
      TODAY,
      { nowTime: '08:00' },
    )
    expect(withCadence.get('pending')).toMatchObject({
      source: 'proyeccion',
      dayISO: TOMORROW,
      timeHHMM: '11:00',
      sourceLabel: 'Sugerida por cadencia',
    })
    expect(reciboVideosForDay([pending], TOMORROW, withCadence).map((row) => row.id)).toEqual(['pending'])

    const none = buildReciboPublishLookup([pending], { lab: { postingDays: [], postingTime: '11:00' } }, TODAY)
    expect(none.get('pending')?.source).toBe('none')
    expect(reciboVideosForDay([pending], TOMORROW, none)).toEqual([])
  })

  it('Hoy y Mañana se anclan al calendario de Puerto Rico', () => {
    expect(reciboDayPresets(TODAY)).toEqual({ today: TODAY, tomorrow: TOMORROW })
  })
})
