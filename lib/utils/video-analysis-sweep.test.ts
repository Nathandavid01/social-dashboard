import { describe, it, expect } from 'vitest'
import { staleAnalysisCandidates } from './video-analysis-sweep'

const now = new Date('2026-08-15T12:00:00Z')
const old = '2026-08-15T11:00:00Z'      // hace 1h
const recent = '2026-08-15T11:45:00Z'   // hace 15min
const vid = (id: string, uploaded_at: string) => ({ id, idea_id: `idea-${id}`, uploaded_at })

describe('staleAnalysisCandidates', () => {
  it('editado viejo SIN fila de análisis → candidato, hasRow: false (el cron debe insert-ignore, no update)', () => {
    expect(staleAnalysisCandidates([vid('a', old)], [], now)).toEqual([
      { videoId: 'a', ideaId: 'idea-a', hasRow: false },
    ])
  })
  it('pending estancado (>30min) → candidato con hasRow: true; done/error → no', () => {
    const vids = [vid('a', old), vid('b', old), vid('c', old)]
    const rows = [
      { video_id: 'a', status: 'pending', updated_at: old },
      { video_id: 'b', status: 'done', updated_at: old },
      { video_id: 'c', status: 'error', updated_at: old },
    ]
    expect(staleAnalysisCandidates(vids, rows, now)).toEqual([
      { videoId: 'a', ideaId: 'idea-a', hasRow: true },
    ])
  })
  it('subida reciente o pending fresco → aún no es candidato', () => {
    const rows = [{ video_id: 'b', status: 'pending', updated_at: recent }]
    expect(staleAnalysisCandidates([vid('a', recent), vid('b', old)], rows, now)).toEqual([])
  })
})
