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
let ideaResult: { data: unknown; error: unknown } = { data: null, error: null }

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

function ideaChain(result: { data: unknown; error: unknown }) {
  const self: Record<string, unknown> = {
    select: () => self,
    eq: () => self,
    maybeSingle: async () => result,
  }
  return self
}

/** getVideoAnalysis hace DOS consultas a `content_idea_video_analysis`: la
 *  crítica (status/findings) y luego una separada, best-effort, solo para
 *  frame_count — así una columna sin migrar apaga SOLO el contador, nunca el
 *  resto del análisis. `analysisFromCallIndex` distingue cuál es cuál. */
let analysisFromCallIndex = 0
let analysisFrameCountResult: { data: unknown; error: unknown } = { data: null, error: null }

function analysisChain() {
  const callIndex = analysisFromCallIndex++
  let byVideoId = false
  const self: Record<string, unknown> = {
    select: () => self,
    eq: (col: string) => {
      if (col === 'video_id') byVideoId = true
      return self
    },
    order: () => self,
    limit: () => self,
    maybeSingle: async () => {
      if (callIndex > 0) return analysisFrameCountResult
      return byVideoId ? analysisByVideoId : analysisNewestForIdea
    },
  }
  return self
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === 'content_idea_videos') return videoChain(videoResult)
      if (table === 'content_idea_video_analysis') return analysisChain()
      if (table === 'content_ideas') return ideaChain(ideaResult)
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
  ideaResult = { data: null, error: null }
  analysisFromCallIndex = 0
  analysisFrameCountResult = { data: null, error: null }
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

  describe('hasCaption (3ra bolita: caption ya escrito)', () => {
    beforeEach(() => {
      videoResult = { data: { id: 'video-2' }, error: null }
      analysisByVideoId = { data: { status: 'done', findings: DONE_FINDINGS }, error: null }
    })

    it('caption_draft con texto → hasCaption: true', async () => {
      ideaResult = { data: { caption_draft: 'Un caption generado por IA', generated_caption: null }, error: null }
      const res = await getVideoAnalysis('idea-1')
      expect(res.analysis?.hasCaption).toBe(true)
    })

    it('generated_caption con texto (ya guardado por un humano) → hasCaption: true', async () => {
      ideaResult = { data: { caption_draft: null, generated_caption: 'Caption ya aprobado' }, error: null }
      const res = await getVideoAnalysis('idea-1')
      expect(res.analysis?.hasCaption).toBe(true)
    })

    it('ambos vacíos/null → hasCaption: false', async () => {
      ideaResult = { data: { caption_draft: null, generated_caption: null }, error: null }
      const res = await getVideoAnalysis('idea-1')
      expect(res.analysis?.hasCaption).toBe(false)
    })

    it('caption_draft solo espacios en blanco no cuenta como caption → hasCaption: false', async () => {
      ideaResult = { data: { caption_draft: '   ', generated_caption: '' }, error: null }
      const res = await getVideoAnalysis('idea-1')
      expect(res.analysis?.hasCaption).toBe(false)
    })

    it('error de Supabase leyendo content_ideas → degrada a hasCaption: false, sin tumbar el análisis ya resuelto', async () => {
      ideaResult = { data: null, error: { message: 'db down' } }
      const res = await getVideoAnalysis('idea-1')
      expect(res.analysis?.status).toBe('done')
      expect(res.analysis?.hasCaption).toBe(false)
    })

    it('sin fila en content_ideas → hasCaption: false', async () => {
      ideaResult = { data: null, error: null }
      const res = await getVideoAnalysis('idea-1')
      expect(res.analysis?.hasCaption).toBe(false)
    })
  })

  describe('frameCount (contador de fotogramas, v3.39)', () => {
    beforeEach(() => {
      videoResult = { data: { id: 'video-2' }, error: null }
      analysisByVideoId = { data: { status: 'done', findings: DONE_FINDINGS }, error: null }
      ideaResult = { data: { caption_draft: null, generated_caption: null }, error: null }
    })

    it('con frame_count guardado → analysis.frameCount refleja el valor', async () => {
      analysisFrameCountResult = { data: { frame_count: 48 }, error: null }
      const res = await getVideoAnalysis('idea-1')
      expect(res.analysis?.status).toBe('done')
      expect(res.analysis?.frameCount).toBe(48)
    })

    it('sin fila / frame_count null → frameCount: null', async () => {
      analysisFrameCountResult = { data: { frame_count: null }, error: null }
      const res = await getVideoAnalysis('idea-1')
      expect(res.analysis?.frameCount).toBeNull()
    })

    it('columna frame_count no existe todavía (error en esa query) → frameCount: null, sin tumbar el resto del análisis', async () => {
      analysisFrameCountResult = { data: null, error: { message: 'column "frame_count" does not exist' } }
      const res = await getVideoAnalysis('idea-1')
      expect(res.analysis?.status).toBe('done')
      expect(res.analysis?.frameCount).toBeNull()
    })
  })
})
