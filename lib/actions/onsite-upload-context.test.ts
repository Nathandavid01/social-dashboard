import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  denied: false,
  shots: { shots: [{ id: 'i1', title: 'Intro Patricia' }], error: undefined as string | undefined },
  videos: [] as Array<{ id: string; name: string; status: string; kind: string; idea_id: string }>,
  videoError: null as string | null,
  session: { id: 's1', title: 'Mañana', session_date: '2026-09-21', client: { name: 'Blue Chiropractic' } } as Record<string, unknown> | null,
  sessionError: null as string | null,
  videoFilter: { in: [] as string[], eq: '', neq: '' },
}))

vi.mock('@/lib/auth/server', () => ({
  requirePermission: async () => {
    if (state.denied) throw new Error('No autorizado')
  },
}))

vi.mock('@/lib/actions/onsite', () => ({
  getOnsiteShots: async () => state.shots,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {}
      const chain = () => b
      b.select = chain
      b.eq = (col: string, value: string) => {
        if (table === 'content_idea_videos' && col === 'kind') state.videoFilter.eq = value
        return b
      }
      b.neq = (col: string, value: string) => {
        if (table === 'content_idea_videos' && col === 'status') state.videoFilter.neq = value
        return b
      }
      b.in = (col: string, ids: string[]) => {
        if (table === 'content_idea_videos' && col === 'idea_id') state.videoFilter.in = ids
        return b
      }
      b.single = async () => ({
        data: table === 'recording_sessions' ? state.session : null,
        error: table === 'recording_sessions' ? state.sessionError : null,
      })
      b.then = (resolve: (value: unknown) => unknown) => {
        if (table === 'content_idea_videos') {
          return resolve({ data: state.videos, error: state.videoError })
        }
        return resolve({ data: [], error: null })
      }
      return b
    },
  }),
}))

import { getOnsiteUploadContext, listOnsiteRawVideos } from './onsite-upload-context'

beforeEach(() => {
  state.denied = false
  state.shots = { shots: [{ id: 'i1', title: 'Intro Patricia' }], error: undefined }
  state.videos = [
    { id: 'v1', name: 'IMG_1.MOV', status: 'uploaded', kind: 'raw', idea_id: 'i1' },
  ]
  state.videoError = null
  state.session = { id: 's1', title: 'Mañana', session_date: '2026-09-21', client: { name: 'Blue Chiropractic' } }
  state.sessionError = null
  state.videoFilter = { in: [], eq: '', neq: '' }
})

describe('listOnsiteRawVideos', () => {
  it('exige recording.read', async () => {
    state.denied = true
    expect((await listOnsiteRawVideos(['i1'])).error).toBe('No autorizado')
  })

  it('no consulta si no hay ideas', async () => {
    expect(await listOnsiteRawVideos([])).toEqual({ videos: [] })
    expect(state.videoFilter.in).toEqual([])
  })

  it('pide crudos vivos por idea_id, sin embed desnudo', async () => {
    const res = await listOnsiteRawVideos(['i1', 'i2'])
    expect(res.error).toBeUndefined()
    expect(state.videoFilter).toEqual({ in: ['i1', 'i2'], eq: 'raw', neq: 'archived' })
    expect(res.videos).toEqual(state.videos)
  })
})

describe('getOnsiteUploadContext', () => {
  it('exige recording.read', async () => {
    state.denied = true
    expect((await getOnsiteUploadContext('s1')).error).toBe('No autorizado')
  })

  it('arma el contexto con las tomas del call sheet y los crudos', async () => {
    const res = await getOnsiteUploadContext('s1')
    expect(res.error).toBeUndefined()
    expect(res.context).toMatchObject({
      sessionId: 's1',
      clientName: 'Blue Chiropractic',
      sessionTitle: 'Mañana',
      ideas: [{ ideaId: 'i1', title: 'Intro Patricia', rawCount: 1 }],
      uploads: [expect.objectContaining({ name: 'IMG_1.MOV', status: 'uploaded' })],
    })
  })

  it('propaga el error de tomas y no inventa ideas', async () => {
    state.shots = { shots: [], error: 'offline' }
    expect((await getOnsiteUploadContext('s1')).error).toBe('offline')
  })
})
