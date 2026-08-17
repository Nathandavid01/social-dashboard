import { describe, it, expect, vi } from 'vitest'
import { fetchCaptionCorrectionsForPrompt } from './caption-corrections'

function fakeSupabase(rows: unknown[] | null, opts?: { throwOnFrom?: boolean }) {
  return {
    from: (_table: string) => {
      if (opts?.throwOnFrom) throw new Error('relation "caption_corrections" does not exist')
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: async () => ({ data: rows, error: null }),
            }),
          }),
        }),
      }
    },
  } as never
}

describe('fetchCaptionCorrectionsForPrompt', () => {
  it('sin clientId, devuelve vacío sin tocar Supabase', async () => {
    const spy = vi.fn()
    const supabase = { from: spy } as never
    const out = await fetchCaptionCorrectionsForPrompt(supabase, null)
    expect(out).toEqual([])
    expect(spy).not.toHaveBeenCalled()
  })

  it('mapea filas de la tabla a { draft, final } más recientes primero', async () => {
    const supabase = fakeSupabase([
      { draft_text: 'd1', final_text: 'f1', created_at: '2026-01-01' },
      { draft_text: 'd2', final_text: 'f2', created_at: '2026-02-01' },
    ])
    const out = await fetchCaptionCorrectionsForPrompt(supabase, 'c1')
    expect(out[0]).toEqual({ draft: 'd2', final: 'f2' })
    expect(out[1]).toEqual({ draft: 'd1', final: 'f1' })
  })

  it('sin la tabla (migración sin aplicar), degrada a vacío en vez de tirar', async () => {
    const supabase = fakeSupabase(null, { throwOnFrom: true })
    const out = await fetchCaptionCorrectionsForPrompt(supabase, 'c1')
    expect(out).toEqual([])
  })
})
