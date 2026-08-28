import { describe, expect, it } from 'vitest'
import type { IdeaWithPipeline } from '@/lib/supabase/types'
import { buildVideoBank } from './video-bank'

const NOW = Date.parse('2026-08-28T12:00:00.000Z')

function idea(opts: {
  id: string
  clientId?: string
  clientName?: string
  editorId?: string | null
  clientEditorId?: string | null
  productionTaskId?: string | null
  title?: string
  videos?: Array<{ id: string; kind?: 'raw' | 'broll' | 'edited'; status?: string; thumb_keys?: string[]; duration_sec?: number | null }>
  status?: string
  approvalStatus?: string | null
}): IdeaWithPipeline {
  return {
    id: opts.id,
    title: opts.title ?? `Idea ${opts.id}`,
    status: opts.status ?? 'produccion',
    approval_status: opts.approvalStatus ?? null,
    published_at: null,
    client_id: opts.clientId ?? 'c1',
    production_task_id: opts.productionTaskId === undefined ? `pt-${opts.id}` : opts.productionTaskId,
    assignee: opts.editorId ? { id: opts.editorId, full_name: 'Editor Uno' } : null,
    client: {
      id: opts.clientId ?? 'c1',
      name: opts.clientName ?? 'Lucky Pet',
      assigned_to: opts.clientEditorId ?? null,
      posting_days: [1, 3, 5],
      logo_url: null,
    },
    videos: (opts.videos ?? [{ id: `${opts.id}-v1` }]).map((v) => ({
      id: v.id,
      kind: v.kind ?? 'raw',
      status: v.status ?? 'uploaded',
      name: `${v.id}.mp4`,
      thumb_keys: v.thumb_keys ?? null,
      duration_sec: v.duration_sec ?? 120,
      uploaded_at: '2026-08-24T10:00:00.000Z',
      uploaded_by: 'u-camara',
      storage_provider: 'r2',
    })),
  } as unknown as IdeaWithPipeline
}

describe('buildVideoBank', () => {
  it('agrupa por cliente y cuenta cuántos videos tiene cada uno', () => {
    const bank = buildVideoBank(
      [
        idea({ id: 'a', clientId: 'c1', clientName: 'Lucky Pet' }),
        idea({ id: 'b', clientId: 'c1', clientName: 'Lucky Pet' }),
        idea({ id: 'c', clientId: 'c2', clientName: 'Speedy Net' }),
      ],
      { now: NOW },
    )
    expect(bank.rails.map((r) => [r.clientName, r.videoCount])).toEqual([
      ['Lucky Pet', 2],
      ['Speedy Net', 1],
    ])
  })

  it('cuenta cada video, no cada idea: dos crudos de una idea son dos carátulas', () => {
    const bank = buildVideoBank(
      [idea({ id: 'a', videos: [{ id: 'v1' }, { id: 'v2', kind: 'broll' }] })],
      { now: NOW },
    )
    expect(bank.rails[0].videoCount).toBe(2)
    expect(bank.rails[0].videos.map((v) => v.videoId)).toEqual(['v1', 'v2'])
  })

  it('dice a qué editor le tocaría cada video, y por qué', () => {
    const bank = buildVideoBank(
      [
        idea({ id: 'a', clientId: 'c1', editorId: 'e-idea' }),
        idea({ id: 'b', clientId: 'c2', clientEditorId: 'e-cliente' }),
        idea({ id: 'c', clientId: 'c3' }),
      ],
      { now: NOW, editorNames: { 'e-idea': 'Jeander Loop', 'e-cliente': 'Carlos Villalta' } },
    )
    const all = bank.rails.flatMap((r) => r.videos)
    const byIdea = (id: string) => all.find((v) => v.ideaId === id)!
    const [a, b, c] = [byIdea('a'), byIdea('b'), byIdea('c')]
    expect([a.editorId, a.editorName, a.assignedVia]).toEqual(['e-idea', 'Editor Uno', 'idea'])
    expect([b.editorId, b.editorName, b.assignedVia]).toEqual(['e-cliente', 'Carlos Villalta', 'client'])
    expect([c.editorId, c.editorName, c.assignedVia]).toEqual([null, null, null])
  })

  it('lleva el production_task_id para poder reasignar desde el video', () => {
    const bank = buildVideoBank([idea({ id: 'a', productionTaskId: 'pt-77' })], { now: NOW })
    expect(bank.rails[0].videos[0].productionTaskId).toBe('pt-77')
  })

  it('un video sin tarea de producción no se puede reasignar', () => {
    const bank = buildVideoBank([idea({ id: 'a', productionTaskId: null })], { now: NOW })
    expect(bank.rails[0].videos[0].productionTaskId).toBeNull()
  })

  it('lleva las claves de la tira para la carátula, y marca los que aún no la tienen', () => {
    const bank = buildVideoBank(
      [idea({ id: 'a', videos: [{ id: 'v1', thumb_keys: ['k0', 'k1'] }, { id: 'v2' }] })],
      { now: NOW },
    )
    const [conTira, sinTira] = bank.rails[0].videos
    expect(conTira.thumbKeys).toEqual(['k0', 'k1'])
    expect(conTira.hasCover).toBe(true)
    expect(sinTira.thumbKeys).toEqual([])
    expect(sinTira.hasCover).toBe(false)
  })

  it('solo entra material bruto: el corte editado no es banco', () => {
    const bank = buildVideoBank(
      [idea({ id: 'a', videos: [{ id: 'v1', kind: 'raw' }, { id: 'v2', kind: 'edited' }] })],
      { now: NOW },
    )
    expect(bank.rails[0].videos.map((v) => v.videoId)).toEqual(['v1'])
  })

  it('ignora los videos archivados o fallidos', () => {
    const bank = buildVideoBank(
      [idea({ id: 'a', videos: [{ id: 'v1', status: 'archived' }, { id: 'v2', status: 'failed' }, { id: 'v3' }] })],
      { now: NOW },
    )
    expect(bank.rails[0].videos.map((v) => v.videoId)).toEqual(['v3'])
  })

  it('una idea sin ningún crudo no abre carril', () => {
    const bank = buildVideoBank([idea({ id: 'a', videos: [] })], { now: NOW })
    expect(bank.rails).toEqual([])
  })

  it('ignora las ideas descartadas', () => {
    const bank = buildVideoBank([idea({ id: 'a', status: 'descartada' })], { now: NOW })
    expect(bank.rails).toEqual([])
  })

  it('lo ya aprobado sale del banco: ese trabajo está hecho', () => {
    const bank = buildVideoBank([idea({ id: 'a', approvalStatus: 'approved' })], { now: NOW })
    expect(bank.rails).toEqual([])
  })

  it('los carriles sin editor van primero: son los que hay que resolver', () => {
    const bank = buildVideoBank(
      [
        idea({ id: 'a', clientId: 'c1', clientName: 'Con editor', editorId: 'e1' }),
        idea({ id: 'b', clientId: 'c2', clientName: 'Sin editor' }),
      ],
      { now: NOW },
    )
    expect(bank.rails.map((r) => r.clientName)).toEqual(['Sin editor', 'Con editor'])
  })

  it('resume el banco entero: videos, clientes y cuántos van sin editor', () => {
    const bank = buildVideoBank(
      [
        idea({ id: 'a', clientId: 'c1', editorId: 'e1', videos: [{ id: 'v1' }, { id: 'v2' }] }),
        idea({ id: 'b', clientId: 'c2' }),
      ],
      { now: NOW },
    )
    expect(bank.totals).toEqual({ videos: 3, clients: 2, unassigned: 1 })
  })

  it('el carril hereda los días de publicación del cliente', () => {
    const bank = buildVideoBank([idea({ id: 'a' })], { now: NOW })
    expect(bank.rails[0].postingDays).toEqual([1, 3, 5])
  })

  it('trae la duración y quién grabó, para que la tarjeta no dependa de otra consulta', () => {
    const bank = buildVideoBank([idea({ id: 'a', videos: [{ id: 'v1', duration_sec: 194 }] })], {
      now: NOW,
      recorderNames: { 'u-camara': 'Neitan' },
    })
    const video = bank.rails[0].videos[0]
    expect(video.durationSec).toBe(194)
    expect(video.recordedBy).toBe('Neitan')
    expect(video.uploadedAt).toBe('2026-08-24T10:00:00.000Z')
  })

  it('se puede filtrar a lo que no tiene editor', () => {
    const bank = buildVideoBank(
      [
        idea({ id: 'a', clientId: 'c1', editorId: 'e1' }),
        idea({ id: 'b', clientId: 'c2' }),
      ],
      { now: NOW, onlyUnassigned: true },
    )
    expect(bank.rails).toHaveLength(1)
    expect(bank.rails[0].editorId).toBeNull()
  })

  it('el título del video es el de la idea, y cae al hook si no hay título', () => {
    const sinTitulo = { ...idea({ id: 'a' }), title: '   ', hook: 'Un gancho' } as IdeaWithPipeline
    const bank = buildVideoBank([sinTitulo], { now: NOW })
    expect(bank.rails[0].videos[0].title).toBe('Un gancho')
  })
})
