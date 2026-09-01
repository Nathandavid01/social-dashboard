import { describe, expect, it } from 'vitest'
import { buildClientCalendar } from './client-calendar'
import type { ContentIdeaVideo, IdeaWithPipeline } from '@/lib/supabase/types'

/**
 * Calendario por cliente: al escoger un cliente se ven sus videos crudos y
 * editados puestos en sus fechas (subida), más los posteos proyectados.
 */

function video(over: Partial<ContentIdeaVideo>): ContentIdeaVideo {
  return {
    id: Math.random().toString(36).slice(2),
    idea_id: 'x',
    kind: 'raw',
    status: 'uploaded',
    name: 'clip.mp4',
    storage_provider: 'r2',
    uploaded_at: '2026-08-31T10:00:00Z',
    ...over,
  } as ContentIdeaVideo
}

let seq = 0
function idea(over: Partial<IdeaWithPipeline>): IdeaWithPipeline {
  seq += 1
  return {
    id: `i${seq}`,
    client_id: 'c1',
    title: `Idea ${seq}`,
    status: 'grabada',
    approval_status: 'pending',
    client: { id: 'c1', name: 'ARASIBO' },
    videos: [],
    ...over,
  } as unknown as IdeaWithPipeline
}

const FROM = new Date(2026, 7, 31) // lunes 31 ago

describe('buildClientCalendar', () => {
  it('pone crudos y editados del cliente en su fecha de subida', () => {
    const ideas = [
      idea({ videos: [video({ id: 'r1', uploaded_at: '2026-08-31T09:00:00Z' })] }),
      idea({ videos: [video({ id: 'e1', kind: 'edited', uploaded_at: '2026-09-01T15:00:00Z' })] }),
    ]
    const days = buildClientCalendar(ideas, 'c1', { from: FROM, days: 7 })
    const d31 = days.find((d) => d.date === '2026-08-31')!
    const d01 = days.find((d) => d.date === '2026-09-01')!
    expect(d31.videos.map((v) => [v.videoId, v.kind])).toEqual([['r1', 'raw']])
    expect(d01.videos.map((v) => [v.videoId, v.kind])).toEqual([['e1', 'edited']])
  })

  it('ignora videos de otros clientes, b-roll y archivados', () => {
    const ideas = [
      idea({ client_id: 'c2', client: { id: 'c2', name: 'Otro' } as never, videos: [video({})] }),
      idea({ videos: [video({ kind: 'broll' }), video({ status: 'archived' })] }),
    ]
    const days = buildClientCalendar(ideas, 'c1', { from: FROM, days: 7 })
    expect(days.every((d) => d.videos.length === 0)).toBe(true)
  })

  it('los días fuera de la ventana no aparecen; la ventana cubre days días', () => {
    const days = buildClientCalendar([], 'c1', { from: FROM, days: 14 })
    expect(days).toHaveLength(14)
    expect(days[0].date).toBe('2026-08-31')
    expect(days[13].date).toBe('2026-09-13')
  })

  it('marca los días de posteo del cliente para ver dónde caería lo aprobado', () => {
    const days = buildClientCalendar([], 'c1', { from: FROM, days: 7, postingDays: [1, 3] })
    expect(days.filter((d) => d.isPostingDay).map((d) => d.date)).toEqual([
      '2026-08-31', // lunes
      '2026-09-02', // miércoles
    ])
  })
})
