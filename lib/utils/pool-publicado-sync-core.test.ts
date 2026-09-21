import { describe, expect, it } from 'vitest'
import {
  poolIdeasToMarkPublicado,
  publishedMetricoolPostIds,
  type PoolPublicadoSyncIdea,
} from './pool-publicado-sync-core'

const prov = (status: string) => ({ status })

function idea(over: Partial<PoolPublicadoSyncIdea> = {}): PoolPublicadoSyncIdea {
  return {
    id: 'idea-1',
    metricool_post_id: 101,
    posted_at: '2026-09-21T10:00:00Z',
    status: 'producida',
    published_at: null,
    manual_posted_status: null,
    ...over,
  }
}

describe('publishedMetricoolPostIds', () => {
  it('solo incluye posts Metricool con PUBLISHED en todas las redes y sin draft', () => {
    expect(publishedMetricoolPostIds([
      { id: 1, draft: false, providers: [prov('PUBLISHED'), prov('PUBLISHED')] },
      { id: 2, draft: false, providers: [prov('PUBLISHED'), prov('PENDING')] },
      { id: 3, draft: false, providers: [prov('ERROR')] },
      { id: 4, draft: true, providers: [prov('PUBLISHED')] },
      { id: 5, draft: false, providers: [] },
    ])).toEqual([1])
  })

  it('no inventa ids: si Metricool no devolvió posts, la lista queda vacía', () => {
    expect(publishedMetricoolPostIds([])).toEqual([])
  })
})

describe('poolIdeasToMarkPublicado — Agendado + Metricool PUBLISHED → Publicado', () => {
  it('marca el video agendado cuyo post Metricool ya salió, sin Ya se posteó', () => {
    const ideas = [
      idea({ id: 'agendado', metricool_post_id: 101, manual_posted_status: null }),
    ]
    expect(poolIdeasToMarkPublicado(ideas, [101])).toEqual(['agendado'])
  })

  it('es idempotente: lo ya Publicado no se vuelve a marcar', () => {
    expect(poolIdeasToMarkPublicado([
      idea({ id: 'by-status', status: 'publicada', metricool_post_id: 101 }),
      idea({ id: 'by-date', published_at: '2026-09-20T12:00:00Z', metricool_post_id: 101 }),
      idea({ id: 'by-manual', manual_posted_status: 'posted', metricool_post_id: 101 }),
    ], [101])).toEqual([])
  })

  it('PENDING, ERROR, draft o post ausente se quedan Agendado', () => {
    const scheduled = idea({ id: 'still-agendado', metricool_post_id: 202 })
    expect(poolIdeasToMarkPublicado([scheduled], [])).toEqual([])
    expect(poolIdeasToMarkPublicado([scheduled], [999])).toEqual([])
  })

  it('no inventa un post: posted_at sin metricool_post_id no se marca Publicado', () => {
    expect(poolIdeasToMarkPublicado([
      idea({
        id: 'no-post',
        metricool_post_id: null,
        posted_at: '2026-09-21T10:00:00Z',
      }),
    ], [1, 2, 3])).toEqual([])
  })

  it('Listo / Recibo (sin envío Metricool) no se convierten en Publicado', () => {
    expect(poolIdeasToMarkPublicado([
      idea({
        id: 'listo',
        metricool_post_id: null,
        posted_at: null,
        status: 'producida',
      }),
    ], [101])).toEqual([])
  })
})
