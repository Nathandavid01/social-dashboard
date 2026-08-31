import { describe, expect, it } from 'vitest'
import { editorApprovalStats, editorWipLimitFor } from './editor-wip'
import type { IdeaWithPipeline } from '@/lib/supabase/types'

/**
 * WIP dinámico: el tope de videos simultáneos del editor sube con su volumen
 * y su % de aprobación. Base 2 → 3 (≥10 aprobados y ≥80%) → 4 (≥25 y ≥90%).
 */
describe('editorWipLimitFor', () => {
  it('editor nuevo (sin historial) → base 2', () => {
    expect(editorWipLimitFor({ approved: 0, returned: 0 })).toBe(2)
  })

  it('buen porcentaje pero poco volumen → sigue en 2', () => {
    expect(editorWipLimitFor({ approved: 9, returned: 0 })).toBe(2)
  })

  it('≥10 aprobados con ≥80% → 3 (bordes exactos incluidos)', () => {
    expect(editorWipLimitFor({ approved: 10, returned: 2 })).toBe(3) // 83%
    expect(editorWipLimitFor({ approved: 12, returned: 3 })).toBe(3) // 80% exacto
  })

  it('mucho volumen con porcentaje bajo → 2', () => {
    expect(editorWipLimitFor({ approved: 30, returned: 30 })).toBe(2) // 50%
  })

  it('≥25 aprobados con ≥90% → 4', () => {
    expect(editorWipLimitFor({ approved: 27, returned: 3 })).toBe(4) // 90% exacto
  })

  it('≥25 aprobados pero <90% se queda en el escalón que le toque', () => {
    expect(editorWipLimitFor({ approved: 25, returned: 5 })).toBe(3) // 83% → escalón de 3
    expect(editorWipLimitFor({ approved: 25, returned: 10 })).toBe(2) // 71% → base
  })
})

function idea(over: Partial<IdeaWithPipeline>): IdeaWithPipeline {
  return {
    id: Math.random().toString(36).slice(2),
    client_id: 'c1',
    title: 't',
    status: 'grabada',
    approval_status: 'pending',
    ...over,
  } as IdeaWithPipeline
}

describe('editorApprovalStats', () => {
  it('cuenta aprobados y devueltos SOLO del editor (asignado por idea o por cliente)', () => {
    const mine = [
      idea({ approval_status: 'approved', assignee: { id: 'e1', full_name: 'A' } as never }),
      idea({ approval_status: 'revision_needed', assignee: { id: 'e1', full_name: 'A' } as never }),
      idea({ status: 'publicada', client: { id: 'c1', assigned_to: 'e1' } as never }),
    ]
    const foreign = [
      idea({ approval_status: 'approved', assignee: { id: 'e2', full_name: 'B' } as never }),
    ]
    const stats = editorApprovalStats([...mine, ...foreign], 'e1')
    expect(stats).toEqual({ approved: 2, returned: 1 })
  })

  it('sin ideas o sin editor → ceros', () => {
    expect(editorApprovalStats([], 'e1')).toEqual({ approved: 0, returned: 0 })
    expect(editorApprovalStats([idea({})], null)).toEqual({ approved: 0, returned: 0 })
  })
})
