/**
 * Tests for runMetricoolPublishedSync (lib/metricool/sync.ts).
 *
 * Contract under test: closing the one-way sync gap. The DB trigger
 * `sync_idea_status_from_task` propagates production_tasks.status → 'publicado'
 * INTO content_ideas.status, but not the reverse. Metricool sync marks ideas
 * 'publicada' directly (bypassing the trigger), so any linked production_task
 * was left behind at its old status. This sync must also push
 * production_tasks.status = 'publicado' for every idea it just marked
 * published, best-effort (a failure there must not fail the idea sync).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

process.env.METRICOOL_TOKEN = 'tok'
process.env.METRICOOL_USER_ID = 'uid'
process.env.METRICOOL_BLOG_ID = 'blog-default'

vi.mock('@/lib/metricool/scheduler', () => ({
  getScheduledPosts: vi.fn(async () => [
    { id: 1, draft: false, providers: [{ status: 'PUBLISHED' }] },
    { id: 2, draft: false, providers: [{ status: 'PUBLISHED' }] },
  ]),
}))

// Idea rows: idea-1 -> metricool post 1 (should be marked), idea-2 -> post 2
// (should be marked), idea-3 -> post 99 (not published, left alone).
const ideaRows = [
  { id: 'idea-1', metricool_post_id: 1, status: 'aprobado' },
  { id: 'idea-2', metricool_post_id: 2, status: 'aprobado' },
  { id: 'idea-3', metricool_post_id: 99, status: 'aprobado' },
]

let ideaUpdateIds: string[] | null = null
let taskUpdateCall: { statusPayload: unknown; ideaIds: string[] } | null = null
let taskUpdateShouldError = false

function makeSupabase() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'content_ideas') {
        const builder: Record<string, unknown> = {}
        builder.select = vi.fn(() => builder)
        builder.not = vi.fn(() => builder)
        builder.update = vi.fn((payload: unknown) => {
          const b2: Record<string, unknown> = {}
          b2.in = vi.fn(async (_col: string, ids: string[]) => {
            ideaUpdateIds = ids
            void payload
            return { error: null }
          })
          return b2
        })
        // Terminal thenable for the initial select().not().not() chain.
        builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: ideaRows, error: null })
        return builder
      }
      if (table === 'clients') {
        const builder: Record<string, unknown> = {}
        builder.select = vi.fn(() => builder)
        builder.not = vi.fn(() => builder)
        builder.eq = vi.fn(async () => ({ data: [], error: null }))
        return builder
      }
      if (table === 'production_tasks') {
        let payloadCaptured: unknown = null
        let idsCaptured: string[] = []
        const builder: Record<string, unknown> = {}
        builder.update = vi.fn((payload: unknown) => {
          payloadCaptured = payload
          return builder
        })
        builder.in = vi.fn((_col: string, ids: string[]) => {
          idsCaptured = ids
          return builder
        })
        builder.neq = vi.fn(async (_col: string, _val: string) => {
          taskUpdateCall = { statusPayload: payloadCaptured, ideaIds: idsCaptured }
          if (taskUpdateShouldError) return { error: { message: 'task update failed' } }
          return { error: null }
        })
        return builder
      }
      throw new Error(`unexpected table ${table}`)
    }),
  }
}

let supabaseMock = makeSupabase()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => supabaseMock,
}))

beforeEach(() => {
  ideaUpdateIds = null
  taskUpdateCall = null
  taskUpdateShouldError = false
  supabaseMock = makeSupabase()
})

describe('runMetricoolPublishedSync', () => {
  it('marks the matching ideas as publicada', async () => {
    const { runMetricoolPublishedSync } = await import('./sync')
    const result = await runMetricoolPublishedSync()
    expect(result.updated).toBe(2)
    expect(ideaUpdateIds).toEqual(expect.arrayContaining(['idea-1', 'idea-2']))
  })

  it('also pushes the linked production_tasks to publicado (closes the reverse sync gap)', async () => {
    const { runMetricoolPublishedSync } = await import('./sync')
    await runMetricoolPublishedSync()
    expect(taskUpdateCall).not.toBeNull()
    expect(taskUpdateCall).toMatchObject({ statusPayload: { status: 'publicado' } })
    expect(taskUpdateCall?.ideaIds).toEqual(expect.arrayContaining(['idea-1', 'idea-2']))
  })

  it('is best-effort: a failed task update does not fail the overall sync result', async () => {
    taskUpdateShouldError = true
    const { runMetricoolPublishedSync } = await import('./sync')
    const result = await runMetricoolPublishedSync()
    expect(result.updated).toBe(2)
    expect(result.error).toBeUndefined()
  })
})
