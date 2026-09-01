import { describe, expect, it } from 'vitest'
import {
  editorWipIdeaIds,
  groupEditorVideoBank,
  prepareIdeasForEditorBank,
} from './editor-video-bank'
import type { ContentIdeaVideo, IdeaWithPipeline } from '@/lib/supabase/types'

/**
 * WIP dinámico cableado al banco del editor + REGRESIÓN de acceso:
 * un editor solo ve SUS videos (por id de video/idea) — jamás el raw ajeno.
 */

function raw(id: string): ContentIdeaVideo {
  return {
    id,
    idea_id: 'x',
    kind: 'raw',
    status: 'uploaded',
    name: `${id}.mp4`,
    storage_provider: 'r2',
  } as ContentIdeaVideo
}

let seq = 0
function idea(over: Partial<IdeaWithPipeline>): IdeaWithPipeline {
  seq += 1
  return {
    id: `i${seq}`,
    client_id: 'c1',
    title: `t${seq}`,
    status: 'grabada',
    approval_status: 'pending',
    created_at: '2026-08-01T00:00:00Z',
    client: { id: 'c1', name: 'ARASIBO', assigned_to: null },
    videos: [raw(`v${seq}`)],
    ...over,
  } as unknown as IdeaWithPipeline
}

function mine(over: Partial<IdeaWithPipeline> = {}): IdeaWithPipeline {
  return idea({ assignee: { id: 'e1', full_name: 'María' } as never, ...over })
}

describe('editorWipIdeaIds con límite dinámico', () => {
  it('respeta el límite que se le pasa (3 en vez de 2)', () => {
    const ideas = [mine(), mine(), mine(), mine()]
    expect(editorWipIdeaIds(ideas, 'e1').size).toBe(2) // default sigue en 2
    expect(editorWipIdeaIds(ideas, 'e1', undefined, 3).size).toBe(3)
  })
})

describe('prepareIdeasForEditorBank con límite dinámico', () => {
  it('un editor con wipLimit 3 recibe 3 ideas activas con archivos', () => {
    const ideas = [mine(), mine(), mine(), mine()]
    const out = prepareIdeasForEditorBank(ideas, { role: 'editor', userId: 'e1' }, { wipLimit: 3 })
    expect(out.filter((i) => i.bankQueue === 'active')).toHaveLength(3)
    expect(out.filter((i) => i.bankQueue === 'waiting')).toHaveLength(1)
  })

  it('REGRESIÓN: el raw ajeno no llega al editor — ni la idea ni los ids de video', () => {
    const foreign = idea({ assignee: { id: 'e2', full_name: 'Pablo' } as never })
    const out = prepareIdeasForEditorBank([mine(), foreign], { role: 'editor', userId: 'e1' })
    expect(out.map((i) => i.id)).not.toContain(foreign.id)
    const videoIds = out.flatMap((i) => (i.videos ?? []).map((v) => v.id))
    expect(videoIds).not.toContain(foreign.videos![0].id)
  })

  it('REGRESIÓN: lo que espera turno llega SIN archivos (sin ids de video bajables)', () => {
    const ideas = [mine(), mine(), mine()]
    const out = prepareIdeasForEditorBank(ideas, { role: 'editor', userId: 'e1' })
    const waiting = out.filter((i) => i.bankQueue === 'waiting')
    expect(waiting).toHaveLength(1)
    expect(waiting[0].videos).toEqual([])
  })
})

describe('groupEditorVideoBank con wipLimit por editor', () => {
  it('cada fila trae su wipLimit (del mapa) y default 2', () => {
    const rows = groupEditorVideoBank(
      [mine(), idea({ assignee: { id: 'e2', full_name: 'Pablo' } as never })],
      { e1: 'María', e2: 'Pablo' },
      { wipLimits: { e1: 4 } },
    )
    const byId = Object.fromEntries(rows.map((r) => [r.editorId, r.wipLimit]))
    expect(byId['e1']).toBe(4)
    expect(byId['e2']).toBe(2)
  })

  it('cada fila trae su % de aprobación (del mapa) y null sin historial', () => {
    const rows = groupEditorVideoBank(
      [mine(), idea({ assignee: { id: 'e2', full_name: 'Pablo' } as never })],
      { e1: 'María', e2: 'Pablo' },
      { approvalRates: { e1: 95 } },
    )
    const byId = Object.fromEntries(rows.map((r) => [r.editorId, r.approvalRate]))
    expect(byId['e1']).toBe(95)
    expect(byId['e2']).toBeNull()
  })
})
