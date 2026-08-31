import { describe, expect, it } from 'vitest'
import { projectPostingCalendar, type ClientQueueInput } from './projected-calendar'
import type { IdeaWithPipeline } from '@/lib/supabase/types'

/**
 * Calendario proyectado: lo APROBADO y aún no publicado, en el orden y las
 * fechas en que se auto-postearía a Metricool según el posting schedule del
 * cliente. Proyección pura — no toca Metricool.
 */

function approvedIdea(id: string, over: Partial<IdeaWithPipeline> = {}): IdeaWithPipeline {
  return {
    id,
    client_id: 'c1',
    title: `Video ${id}`,
    status: 'producida',
    approval_status: 'approved',
    approved_at: '2026-08-01T12:00:00Z',
    published_at: null,
    ...over,
  } as IdeaWithPipeline
}

function client(over: Partial<ClientQueueInput> = {}): ClientQueueInput {
  return {
    clientId: 'c1',
    clientName: 'ARASIBO',
    postingDays: [1, 3], // lunes y miércoles
    postingTime: '18:00',
    postingSchedule: null,
    ideas: [],
    ...over,
  }
}

// Lunes 31 ago 2026 (local).
const FROM = new Date(2026, 7, 31)

describe('projectPostingCalendar', () => {
  it('proyecta la cola aprobada sobre los posting days, en orden de aprobación', () => {
    const ideas = [
      approvedIdea('b', { approved_at: '2026-08-20T10:00:00Z' }),
      approvedIdea('a', { approved_at: '2026-08-10T10:00:00Z' }),
    ]
    const { posts, overflow } = projectPostingCalendar([client({ ideas })], { from: FROM, days: 7 })
    expect(overflow).toEqual([])
    expect(posts.map((p) => [p.ideaId, p.date, p.time])).toEqual([
      ['a', '2026-08-31', '18:00'], // aprobado primero → primer slot (lunes)
      ['b', '2026-09-02', '18:00'], // miércoles
    ])
  })

  it('ignora lo no aprobado y lo ya publicado', () => {
    const ideas = [
      approvedIdea('ok'),
      approvedIdea('pub', { status: 'publicada', published_at: '2026-08-15T00:00:00Z' }),
      approvedIdea('raw', { approval_status: 'pending' }),
    ]
    const { posts } = projectPostingCalendar([client({ ideas })], { from: FROM, days: 7 })
    expect(posts.map((p) => p.ideaId)).toEqual(['ok'])
  })

  it('cola más larga que la ventana → el resto queda en overflow, en orden', () => {
    const ideas = ['1', '2', '3', '4'].map((id, i) =>
      approvedIdea(id, { approved_at: `2026-08-0${i + 1}T00:00:00Z` }),
    )
    const { posts, overflow } = projectPostingCalendar([client({ ideas })], { from: FROM, days: 7 })
    expect(posts.map((p) => p.ideaId)).toEqual(['1', '2']) // lun + mié
    expect(overflow.map((o) => o.ideaId)).toEqual(['3', '4'])
  })

  it('cliente sin posting days → toda la cola a overflow', () => {
    const { posts, overflow } = projectPostingCalendar(
      [client({ postingDays: [], ideas: [approvedIdea('x')] })],
      { from: FROM, days: 7 },
    )
    expect(posts).toEqual([])
    expect(overflow.map((o) => o.ideaId)).toEqual(['x'])
  })

  it('sin approved_at cae a updated_at y el empate se rompe por id (determinista)', () => {
    const ideas = [
      approvedIdea('z', { approved_at: null, updated_at: '2026-08-05T00:00:00Z' } as never),
      approvedIdea('a', { approved_at: null, updated_at: '2026-08-05T00:00:00Z' } as never),
    ]
    const { posts } = projectPostingCalendar([client({ ideas })], { from: FROM, days: 7 })
    expect(posts.map((p) => p.ideaId)).toEqual(['a', 'z'])
  })

  it('varios clientes: los posts salen ordenados por fecha', () => {
    const c1 = client({ ideas: [approvedIdea('uno')] }) // lunes 31
    const c2 = client({
      clientId: 'c2',
      clientName: 'Otro',
      postingDays: [0], // domingo 6 sep
      ideas: [approvedIdea('dos', { client_id: 'c2' })],
    })
    const { posts } = projectPostingCalendar([c2, c1], { from: FROM, days: 7 })
    expect(posts.map((p) => [p.ideaId, p.date])).toEqual([
      ['uno', '2026-08-31'],
      ['dos', '2026-09-06'],
    ])
  })
})
