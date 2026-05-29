import { describe, it, expect } from 'vitest'
import { notifyVideoUploaded } from '@/lib/utils/video-upload-notify'

/**
 * notifyVideoUploaded must:
 *  - skip b-roll (too noisy),
 *  - notify the client's assigned manager when set,
 *  - fall back to all owners when the client is unassigned,
 *  - never ping the uploader about their own upload,
 *  - use kind 'review_pending' for edited and 'task_completed' for raw,
 *  - link to the idea detail.
 * The supabase client is mocked to record the inserted notification rows.
 */

type Idea = { title: string; client: { name: string; assigned_to: string | null } | null } | null

function makeSupabase(cfg: { idea: Idea; owners?: { id: string }[] }) {
  const inserted: Array<Record<string, unknown>> = []
  const supabase = {
    from(table: string) {
      if (table === 'content_ideas') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: cfg.idea, error: cfg.idea ? null : { message: 'not found' } }),
            }),
          }),
        }
      }
      if (table === 'profiles') {
        return { select: () => ({ eq: async () => ({ data: cfg.owners ?? [], error: null }) }) }
      }
      if (table === 'notifications') {
        return {
          insert: async (rows: Record<string, unknown> | Record<string, unknown>[]) => {
            inserted.push(...(Array.isArray(rows) ? rows : [rows]))
            return { error: null }
          },
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { supabase: supabase as any, inserted }
}

describe('notifyVideoUploaded', () => {
  it('skips b-roll entirely (no notifications)', async () => {
    const { supabase, inserted } = makeSupabase({ idea: { title: 'X', client: { name: 'C', assigned_to: 'mgr' } } })
    await notifyVideoUploaded(supabase, { ideaId: 'i1', kind: 'broll', uploaderId: 'someone' })
    expect(inserted).toHaveLength(0)
  })

  it('notifies the assigned manager for an edited video with kind review_pending', async () => {
    const { supabase, inserted } = makeSupabase({ idea: { title: 'Promo finde', client: { name: '612 C. Lounge', assigned_to: 'mgr-1' } } })
    await notifyVideoUploaded(supabase, { ideaId: 'i1', kind: 'edited', uploaderId: 'editor-9' })
    expect(inserted).toHaveLength(1)
    expect(inserted[0]).toMatchObject({
      user_id: 'mgr-1',
      kind: 'review_pending',
      link: '/produccion/idea/i1',
      severity: 'info',
    })
    expect(String(inserted[0].title)).toMatch(/editado/i)
    expect(String(inserted[0].title)).toContain('612 C. Lounge')
  })

  it('falls back to all owners (kind task_completed) for a raw upload on an unassigned client', async () => {
    const { supabase, inserted } = makeSupabase({
      idea: { title: 'B-roll cocina', client: { name: 'AA Real Estate', assigned_to: null } },
      owners: [{ id: 'owner-1' }, { id: 'owner-2' }],
    })
    await notifyVideoUploaded(supabase, { ideaId: 'i2', kind: 'raw', uploaderId: 'video-3' })
    expect(inserted).toHaveLength(2)
    expect(inserted.map((r) => r.user_id).sort()).toEqual(['owner-1', 'owner-2'])
    expect(inserted.every((r) => r.kind === 'task_completed')).toBe(true)
    expect(String(inserted[0].title)).toMatch(/crudo/i)
  })

  it('never pings the uploader about their own upload', async () => {
    const { supabase, inserted } = makeSupabase({ idea: { title: 'X', client: { name: 'C', assigned_to: 'mgr-1' } } })
    await notifyVideoUploaded(supabase, { ideaId: 'i1', kind: 'edited', uploaderId: 'mgr-1' })
    expect(inserted).toHaveLength(0)
  })

  it('does nothing when the idea is not found', async () => {
    const { supabase, inserted } = makeSupabase({ idea: null })
    await notifyVideoUploaded(supabase, { ideaId: 'missing', kind: 'edited', uploaderId: 'x' })
    expect(inserted).toHaveLength(0)
  })
})
