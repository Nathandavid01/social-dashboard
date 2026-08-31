import { describe, expect, it } from 'vitest'
import { buildGlobalBroll } from './global-broll'
import type { ContentIdeaVideo, IdeaWithPipeline } from '@/lib/supabase/types'

/**
 * B-roll y files globales: todo editor que entra al banco puede ver y bajar el
 * b-roll de TODOS los clientes. Los crudos (raw) NO entran aquí — siguen
 * scoped a la asignación (regresión: un editor no ve raw ajeno por esta vía).
 */

function video(over: Partial<ContentIdeaVideo>): ContentIdeaVideo {
  return {
    id: Math.random().toString(36).slice(2),
    idea_id: 'i1',
    kind: 'broll',
    status: 'uploaded',
    name: 'clip.mp4',
    storage_provider: 'r2',
    drive_view_link: null,
    ...over,
  } as ContentIdeaVideo
}

function idea(over: Partial<IdeaWithPipeline>): IdeaWithPipeline {
  return {
    id: Math.random().toString(36).slice(2),
    client_id: 'c1',
    title: 't',
    status: 'grabada',
    approval_status: 'pending',
    client: { id: 'c1', name: 'ARASIBO' },
    videos: [],
    ...over,
  } as unknown as IdeaWithPipeline
}

describe('buildGlobalBroll', () => {
  it('junta el b-roll vivo de todos los clientes, agrupado por cliente', () => {
    const ideas = [
      idea({ videos: [video({ id: 'b1', name: 'playa.mp4' })] }),
      idea({
        client_id: 'c2',
        client: { id: 'c2', name: 'Otro' } as never,
        videos: [video({ id: 'b2', name: 'gym.mp4' })],
      }),
    ]
    const groups = buildGlobalBroll(ideas)
    expect(groups.map((g) => [g.clientName, g.files.map((f) => f.id)])).toEqual([
      ['ARASIBO', ['b1']],
      ['Otro', ['b2']],
    ])
  })

  it('REGRESIÓN: los raw NO se filtran al pool global, y lo archivado/fallido tampoco', () => {
    const ideas = [
      idea({
        videos: [
          video({ id: 'raw1', kind: 'raw' }),
          video({ id: 'dead', status: 'archived' }),
          video({ id: 'fail', status: 'failed' }),
          video({ id: 'ok' }),
        ],
      }),
    ]
    const groups = buildGlobalBroll(ideas)
    expect(groups).toHaveLength(1)
    expect(groups[0].files.map((f) => f.id)).toEqual(['ok'])
  })

  it('ideas descartadas o sin cliente no aportan nada; sin b-roll → lista vacía', () => {
    expect(buildGlobalBroll([idea({ status: 'descartada', videos: [video({})] })])).toEqual([])
    expect(buildGlobalBroll([idea({ client: null as never, client_id: null as never, videos: [video({})] })])).toEqual([])
    expect(buildGlobalBroll([])).toEqual([])
  })
})
