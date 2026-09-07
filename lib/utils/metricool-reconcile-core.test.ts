import { describe, expect, it } from 'vitest'
import { reconcilePostedIdeas, type ReconcilePost } from './metricool-reconcile-core'
import type { SyncIdeaRef } from './metricool-sync-core'

const idea = (id: string, postId: number | null, status = 'producida'): SyncIdeaRef => ({
  id,
  metricool_post_id: postId,
  status,
})

const post = (id: number, statuses: string[], draft = false): ReconcilePost => ({
  id,
  draft,
  providers: statuses.map((status) => ({ status })),
})

describe('reconcilePostedIdeas', () => {
  it('cierra solo lo que Metricool confirma publicado en todas sus redes', () => {
    const res = reconcilePostedIdeas(
      [idea('a', 1), idea('b', 2)],
      [post(1, ['PUBLISHED', 'PUBLISHED']), post(2, ['PUBLISHED', 'PENDING'])],
    )
    expect(res.toMarkPublished).toEqual(['a'])
    expect(res.counts.published).toBe(1)
    expect(res.counts.scheduled).toBe(1)
  })

  /**
   * El caso que dejaba 67 ideas colgadas en producción: el post ya no existe en
   * Metricool, así que el sync viejo no las tocaba nunca.
   */
  it('un post que ya no existe en Metricool se marca desaparecido, no publicado', () => {
    const res = reconcilePostedIdeas([idea('a', 999)], [])
    expect(res.counts.missing).toBe(1)
    expect(res.missing.map((m) => m.ideaId)).toEqual(['a'])
    expect(res.toMarkPublished).toEqual([])
  })

  it('si la consulta a Metricool falló, lo no encontrado queda como desconocido', () => {
    // Declarar "desapareció" por un fallo de red sería peor que no saber.
    const res = reconcilePostedIdeas([idea('a', 999)], [], false)
    expect(res.counts.unknown).toBe(1)
    expect(res.counts.missing).toBe(0)
    expect(res.missing).toEqual([])
  })

  it('una red en ERROR es un fallo que pide mano, no una publicación', () => {
    const res = reconcilePostedIdeas([idea('a', 1)], [post(1, ['PUBLISHED', 'ERROR'])])
    expect(res.counts.failed).toBe(1)
    expect(res.toMarkPublished).toEqual([])
  })

  it('un borrador no cuenta como publicado aunque sus redes lo digan', () => {
    const res = reconcilePostedIdeas([idea('a', 1)], [post(1, ['PUBLISHED'], true)])
    expect(res.counts.draft).toBe(1)
    expect(res.counts.scheduled).toBe(0)
    expect(res.toMarkPublished).toEqual([])
  })

  it('un post sin redes todavía no salió', () => {
    const res = reconcilePostedIdeas([idea('a', 1)], [{ id: 1, draft: false, providers: [] }])
    expect(res.counts.scheduled).toBe(1)
  })

  it('no vuelve a tocar lo ya publicado ni lo descartado', () => {
    const res = reconcilePostedIdeas(
      [idea('a', 1, 'publicada'), idea('b', 2, 'descartada')],
      [post(1, ['PUBLISHED'])],
    )
    expect(res.rows).toEqual([])
  })

  it('ignora las ideas que nunca se mandaron', () => {
    const res = reconcilePostedIdeas([idea('a', null)], [])
    expect(res.rows).toEqual([])
  })

  it('resume todo por desenlace, para poder avisar de un vistazo', () => {
    const res = reconcilePostedIdeas(
      [idea('a', 1), idea('b', 2), idea('c', 3), idea('d', 4)],
      [post(1, ['PUBLISHED']), post(2, ['PENDING']), post(3, ['ERROR'])],
    )
    expect(res.counts).toEqual({ published: 1, scheduled: 1, draft: 0, failed: 1, missing: 1, unknown: 0 })
  })
})
