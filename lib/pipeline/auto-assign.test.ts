import { describe, expect, it } from 'vitest'
import { planAutoAssign } from './auto-assign'
import type { ContentIdeaVideo, IdeaWithPipeline } from '@/lib/supabase/types'

/**
 * Autoasignación del banco: los crudos SIN editor se reparten solos a los
 * espacios libres, por orden de prioridad (deadline más urgente primero,
 * luego el más viejo). Determinista — misma entrada, mismo plan.
 */

function raw(id: string): ContentIdeaVideo {
  return { id, idea_id: 'x', kind: 'raw', status: 'uploaded', name: `${id}.mp4`, storage_provider: 'r2' } as ContentIdeaVideo
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
    created_at: '2026-08-10T00:00:00Z',
    deadline: null,
    published_at: null,
    client: { id: 'c1', name: 'ARASIBO', assigned_to: null },
    production_task: { id: `pt-i${seq + 0}`, status: 'pending', publish_date: null },
    videos: [raw(`v${seq}`)],
    ...over,
  } as unknown as IdeaWithPipeline
}

const TODAY = '2026-08-31'

describe('planAutoAssign', () => {
  it('reparte los crudos sin editor a los espacios libres por prioridad (deadline primero)', () => {
    const urgent = idea({ deadline: '2026-08-30' }) // vencido → primero
    const old = idea({ created_at: '2026-08-01T00:00:00Z' })
    const newer = idea({ created_at: '2026-08-20T00:00:00Z' })
    const plan = planAutoAssign([newer, urgent, old], [
      { id: 'e1', freeSlots: 1 },
      { id: 'e2', freeSlots: 2 },
    ], TODAY)
    // e2 tiene más espacio → recibe el más urgente; luego alterna.
    expect(plan).toEqual([
      { productionTaskId: urgent.production_task!.id, ideaId: urgent.id, editorId: 'e2' },
      { productionTaskId: old.production_task!.id, ideaId: old.id, editorId: 'e1' },
      { productionTaskId: newer.production_task!.id, ideaId: newer.id, editorId: 'e2' },
    ])
  })

  it('NO toca lo ya asignado (por idea o por cliente) ni lo que no está listo', () => {
    const assigned = idea({ assignee: { id: 'e9', full_name: 'Otro' } as never })
    const inherited = idea({ client: { id: 'c2', name: 'X', assigned_to: 'e9' } as never })
    const noVideos = idea({ videos: [] })
    const noTask = idea({ production_task: null })
    const plan = planAutoAssign([assigned, inherited, noVideos, noTask], [{ id: 'e1', freeSlots: 5 }], TODAY)
    expect(plan).toEqual([])
  })

  it('sin espacios libres no asigna nada; los sobrantes quedan fuera del plan', () => {
    const a = idea({})
    const b = idea({})
    expect(planAutoAssign([a, b], [{ id: 'e1', freeSlots: 0 }], TODAY)).toEqual([])
    expect(planAutoAssign([a, b], [{ id: 'e1', freeSlots: 1 }], TODAY)).toHaveLength(1)
  })

  it('empate total se rompe determinista por created_at y luego id', () => {
    const x = idea({ id: 'zz' } as never)
    const y = idea({ id: 'aa' } as never)
    const plan = planAutoAssign([x, y], [{ id: 'e1', freeSlots: 2 }], TODAY)
    expect(plan.map((p) => p.ideaId)).toEqual(['aa', 'zz'])
  })
})
