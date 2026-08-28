import { describe, expect, it } from 'vitest'
import type { IdeaWithPipeline } from '@/lib/supabase/types'
import { buildEditorPace, estimateDaysForEditor, teamMedianDays } from './editor-pace'

const DAY = 86_400_000
const NOW = Date.parse('2026-08-28T12:00:00.000Z')

function iso(daysAgo: number): string {
  return new Date(NOW - daysAgo * DAY).toISOString()
}

/**
 * Idea entregada: un crudo y un editado. El ritmo es la distancia entre ambos,
 * que es lo único que la base ya guarda hoy (created_at de cada video).
 */
function delivered(opts: {
  id: string
  editorId: string | null
  rawDaysAgo: number
  editedDaysAgo: number
  clientEditorId?: string | null
}): IdeaWithPipeline {
  return {
    id: opts.id,
    title: `Idea ${opts.id}`,
    status: 'produccion',
    assignee: opts.editorId ? { id: opts.editorId, full_name: 'Editor' } : null,
    client: opts.clientEditorId === undefined ? null : ({ assigned_to: opts.clientEditorId } as never),
    videos: [
      { id: `${opts.id}-raw`, kind: 'raw', status: 'uploaded', uploaded_at: iso(opts.rawDaysAgo) },
      { id: `${opts.id}-cut`, kind: 'edited', status: 'uploaded', uploaded_at: iso(opts.editedDaysAgo) },
    ],
  } as unknown as IdeaWithPipeline
}

describe('buildEditorPace', () => {
  it('mide la mediana de días entre el crudo y el editado', () => {
    const ideas = [
      delivered({ id: 'a', editorId: 'e1', rawDaysAgo: 10, editedDaysAgo: 8 }), // 2 d
      delivered({ id: 'b', editorId: 'e1', rawDaysAgo: 9, editedDaysAgo: 6 }), // 3 d
      delivered({ id: 'c', editorId: 'e1', rawDaysAgo: 7, editedDaysAgo: 3 }), // 4 d
    ]
    const [pace] = buildEditorPace(ideas, { now: NOW })
    expect(pace.editorId).toBe('e1')
    expect(pace.medianDays).toBe(3)
    expect(pace.delivered).toBe(3)
  })

  it('usa la mediana, no el promedio: un video atascado no mueve la cifra', () => {
    const ideas = [
      delivered({ id: 'a', editorId: 'e1', rawDaysAgo: 20, editedDaysAgo: 19 }), // 1 d
      delivered({ id: 'b', editorId: 'e1', rawDaysAgo: 18, editedDaysAgo: 16 }), // 2 d
      delivered({ id: 'c', editorId: 'e1', rawDaysAgo: 29, editedDaysAgo: 1 }), // 28 d
    ]
    const [pace] = buildEditorPace(ideas, { now: NOW })
    expect(pace.medianDays).toBe(2) // el promedio sería 10.3
  })

  it('con número par de entregas promedia las dos del medio', () => {
    const ideas = [
      delivered({ id: 'a', editorId: 'e1', rawDaysAgo: 10, editedDaysAgo: 9 }), // 1 d
      delivered({ id: 'b', editorId: 'e1', rawDaysAgo: 10, editedDaysAgo: 8 }), // 2 d
      delivered({ id: 'c', editorId: 'e1', rawDaysAgo: 10, editedDaysAgo: 7 }), // 3 d
      delivered({ id: 'd', editorId: 'e1', rawDaysAgo: 10, editedDaysAgo: 6 }), // 4 d
    ]
    const [pace] = buildEditorPace(ideas, { now: NOW })
    expect(pace.medianDays).toBe(2.5)
  })

  it('cae al editor del cliente cuando la idea no tiene asignado propio', () => {
    const ideas = [delivered({ id: 'a', editorId: null, clientEditorId: 'e9', rawDaysAgo: 5, editedDaysAgo: 3 })]
    const [pace] = buildEditorPace(ideas, { now: NOW })
    expect(pace.editorId).toBe('e9')
    expect(pace.medianDays).toBe(2)
  })

  it('ignora las entregas fuera de la ventana', () => {
    const ideas = [
      delivered({ id: 'viejo', editorId: 'e1', rawDaysAgo: 70, editedDaysAgo: 60 }), // 10 d, hace 2 meses
      delivered({ id: 'nuevo', editorId: 'e1', rawDaysAgo: 4, editedDaysAgo: 2 }), // 2 d
    ]
    const [pace] = buildEditorPace(ideas, { now: NOW, windowDays: 30 })
    expect(pace.delivered).toBe(1)
    expect(pace.medianDays).toBe(2)
  })

  it('compara con la ventana anterior para dar la tendencia', () => {
    const ideas = [
      // ventana previa (31–60 días): 2 d
      delivered({ id: 'p1', editorId: 'e1', rawDaysAgo: 47, editedDaysAgo: 45 }),
      delivered({ id: 'p2', editorId: 'e1', rawDaysAgo: 42, editedDaysAgo: 40 }),
      // ventana actual: 5 d
      delivered({ id: 'a1', editorId: 'e1', rawDaysAgo: 12, editedDaysAgo: 7 }),
      delivered({ id: 'a2', editorId: 'e1', rawDaysAgo: 10, editedDaysAgo: 5 }),
    ]
    const [pace] = buildEditorPace(ideas, { now: NOW, windowDays: 30 })
    expect(pace.medianDays).toBe(5)
    expect(pace.previousMedianDays).toBe(2)
    expect(pace.trendDays).toBe(3) // positivo = se está tardando más
  })

  it('sin entregas previas la tendencia queda nula, no en cero', () => {
    const ideas = [delivered({ id: 'a', editorId: 'e1', rawDaysAgo: 4, editedDaysAgo: 2 })]
    const [pace] = buildEditorPace(ideas, { now: NOW })
    expect(pace.previousMedianDays).toBeNull()
    expect(pace.trendDays).toBeNull()
  })

  it('descarta ideas sin editado, sin crudo o con fechas invertidas', () => {
    const sinEditado = {
      id: 'x',
      title: 'x',
      status: 'produccion',
      assignee: { id: 'e1', full_name: 'Editor' },
      videos: [{ id: 'x-raw', kind: 'raw', status: 'uploaded', uploaded_at: iso(5) }],
    } as unknown as IdeaWithPipeline
    const invertida = delivered({ id: 'y', editorId: 'e1', rawDaysAgo: 2, editedDaysAgo: 6 })
    expect(buildEditorPace([sinEditado, invertida], { now: NOW })).toEqual([])
  })

  it('un editado el mismo día cuenta como medio día, no como cero', () => {
    const ideas = [delivered({ id: 'a', editorId: 'e1', rawDaysAgo: 3, editedDaysAgo: 3 })]
    const [pace] = buildEditorPace(ideas, { now: NOW })
    expect(pace.medianDays).toBe(0.5)
  })

  it('ordena de más rápido a más lento y separa a cada editor', () => {
    const ideas = [
      delivered({ id: 'a', editorId: 'lento', rawDaysAgo: 10, editedDaysAgo: 6 }), // 4 d
      delivered({ id: 'b', editorId: 'rapido', rawDaysAgo: 10, editedDaysAgo: 9 }), // 1 d
    ]
    const paces = buildEditorPace(ideas, { now: NOW })
    expect(paces.map((p) => p.editorId)).toEqual(['rapido', 'lento'])
  })

  it('ignora las ideas descartadas', () => {
    const descartada = { ...delivered({ id: 'a', editorId: 'e1', rawDaysAgo: 5, editedDaysAgo: 3 }), status: 'descartada' }
    expect(buildEditorPace([descartada as IdeaWithPipeline], { now: NOW })).toEqual([])
  })

  it('ignora los videos archivados o fallidos al buscar el crudo y el corte', () => {
    const idea = {
      id: 'a',
      title: 'a',
      status: 'produccion',
      assignee: { id: 'e1', full_name: 'Editor' },
      videos: [
        { id: 'raw-malo', kind: 'raw', status: 'archived', uploaded_at: iso(30) },
        { id: 'raw', kind: 'raw', status: 'uploaded', uploaded_at: iso(5) },
        { id: 'cut-malo', kind: 'edited', status: 'failed', uploaded_at: iso(1) },
        { id: 'cut', kind: 'edited', status: 'uploaded', uploaded_at: iso(3) },
      ],
    } as unknown as IdeaWithPipeline
    const [pace] = buildEditorPace([idea], { now: NOW })
    expect(pace.medianDays).toBe(2)
  })
})

describe('teamMedianDays', () => {
  it('es la mediana de las medianas de cada editor', () => {
    const paces = [
      { editorId: 'a', medianDays: 1, delivered: 3, previousMedianDays: null, trendDays: null },
      { editorId: 'b', medianDays: 2, delivered: 3, previousMedianDays: null, trendDays: null },
      { editorId: 'c', medianDays: 6, delivered: 3, previousMedianDays: null, trendDays: null },
    ]
    expect(teamMedianDays(paces)).toBe(2)
  })

  it('sin editores devuelve null', () => {
    expect(teamMedianDays([])).toBeNull()
  })
})

describe('estimateDaysForEditor', () => {
  it('estima con el ritmo del editor', () => {
    const pace = { editorId: 'e1', medianDays: 2.4, delivered: 5, previousMedianDays: null, trendDays: null }
    expect(estimateDaysForEditor(pace, { teamMedianDays: 3 })).toBe(2.4)
  })

  it('un editor sin historial hereda la mediana del equipo', () => {
    expect(estimateDaysForEditor(null, { teamMedianDays: 3 })).toBe(3)
  })

  it('sin historial de nadie no inventa un número', () => {
    expect(estimateDaysForEditor(null, { teamMedianDays: null })).toBeNull()
  })
})
