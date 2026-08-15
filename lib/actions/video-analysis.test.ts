import { describe, it, expect, vi, beforeEach } from 'vitest'

const currentUserHas = vi.fn(async (_perm: string) => true)
vi.mock('@/lib/auth/server', () => ({
  currentUserHas: (perm: string) => currentUserHas(perm),
}))

/** `videoResult` is what the "current edited video" lookup on
 *  `content_idea_videos` resolves to. `analysisByVideoId` resolves an analysis
 *  row `.eq('video_id', id)`; `analysisNewestForIdea` is what a (wrong, legacy)
 *  `.eq('idea_id', id).order('updated_at desc').limit(1)` query would return —
 *  kept distinct so a regression back to "latest row for the idea" fails loudly. */
let videoResult: { data: unknown; error: unknown } = { data: null, error: null }
let analysisByVideoId: { data: unknown; error: unknown } = { data: null, error: null }
let analysisNewestForIdea: { data: unknown; error: unknown } = { data: null, error: null }

function videoChain(result: { data: unknown; error: unknown }) {
  const self: Record<string, unknown> = {
    select: () => self,
    eq: () => self,
    not: () => self,
    order: () => self,
    limit: () => self,
    maybeSingle: async () => result,
  }
  return self
}

function analysisChain() {
  let byVideoId = false
  const self: Record<string, unknown> = {
    select: () => self,
    eq: (col: string) => {
      if (col === 'video_id') byVideoId = true
      return self
    },
    order: () => self,
    limit: () => self,
    maybeSingle: async () => (byVideoId ? analysisByVideoId : analysisNewestForIdea),
  }
  return self
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === 'content_idea_videos') return videoChain(videoResult)
      if (table === 'content_idea_video_analysis') return analysisChain()
      throw new Error(`unexpected table ${table}`)
    },
  }),
}))

import { getVideoAnalysis } from './video-analysis'

beforeEach(() => {
  currentUserHas.mockReset().mockResolvedValue(true)
  videoResult = { data: null, error: null }
  analysisByVideoId = { data: null, error: null }
  analysisNewestForIdea = { data: null, error: null }
})

const DONE_FINDINGS = { burned_captions: { text: '', issues: [] }, relevance: { verdict: 'ok', explanation: '' }, visual_summary: null }

describe('getVideoAnalysis', () => {
  it('resuelve el análisis del video vigente (v2 done), no la fila más reciente de la idea (v1 error con updated_at más nuevo, escrita por la barrida)', async () => {
    // El video vigente es el más reciente edited/no-archivado de la idea (v2).
    videoResult = { data: { id: 'video-2' }, error: null }
    // La fila del video vigente está 'done'.
    analysisByVideoId = { data: { status: 'done', findings: DONE_FINDINGS }, error: null }
    // Una consulta legacy "más reciente por idea" vería el 'error' de v1 (más
    // nuevo por la barrida) — si la acción regresa a ese camino, este test cae.
    analysisNewestForIdea = { data: { status: 'error', findings: null }, error: null }

    const res = await getVideoAnalysis('idea-1')
    expect(res.analysis?.status).toBe('done')
  })

  it('sin video editado vigente → analysis: null', async () => {
    videoResult = { data: null, error: null }
    const res = await getVideoAnalysis('idea-1')
    expect(res.analysis).toBeNull()
  })

  it('sin autorización → error', async () => {
    currentUserHas.mockResolvedValue(false)
    const res = await getVideoAnalysis('idea-1')
    expect(res.error).toBe('No autorizado')
  })

  it('error de Supabase al buscar el video vigente → degrada a analysis: null', async () => {
    videoResult = { data: null, error: { message: 'db down' } }
    const res = await getVideoAnalysis('idea-1')
    expect(res.analysis).toBeNull()
  })

  it('sin fila de análisis para el video vigente → analysis: null', async () => {
    videoResult = { data: { id: 'video-2' }, error: null }
    analysisByVideoId = { data: null, error: null }
    const res = await getVideoAnalysis('idea-1')
    expect(res.analysis).toBeNull()
  })
})
