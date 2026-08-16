/**
 * getProductionTasks must attach each task's linked idea's status/published_at
 * so the calendar chip can compute isReallyPublished without a fragile PostgREST
 * embed (repo has PGRST201 history — see CLAUDE.md). Plain second query on
 * content_ideas, keyed by the task's idea_id, then merged in memory.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const tasks = [
  { id: 'task-1', idea_id: 'idea-1', status: 'aprobado', publish_date: '2026-08-18', content_type: 'R' },
  { id: 'task-2', idea_id: 'idea-2', status: 'pendiente', publish_date: '2026-08-19', content_type: 'P' },
  { id: 'task-3', idea_id: null, status: 'pendiente', publish_date: '2026-08-20', content_type: 'R' },
  // idea_id points at a row that doesn't exist in `ideas` below (e.g. deleted
  // idea) — must not throw and must fall back to null, not undefined.
  { id: 'task-4', idea_id: 'idea-missing', status: 'pendiente', publish_date: '2026-08-21', content_type: 'P' },
]

const ideas = [
  { id: 'idea-1', status: 'publicada', published_at: '2026-08-18T12:00:00Z' },
  { id: 'idea-2', status: 'aprobado', published_at: null },
]

function makeSupabase() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'production_tasks') {
        const builder: Record<string, unknown> = {}
        builder.select = vi.fn(() => builder)
        builder.order = vi.fn(() => builder)
        builder.gte = vi.fn(() => builder)
        builder.lte = vi.fn(() => builder)
        builder.eq = vi.fn(() => builder)
        builder.limit = vi.fn(async () => ({ data: tasks, error: null }))
        return builder
      }
      if (table === 'content_ideas') {
        const builder: Record<string, unknown> = {}
        builder.select = vi.fn(() => builder)
        builder.in = vi.fn(async () => ({ data: ideas, error: null }))
        return builder
      }
      throw new Error(`unexpected table ${table}`)
    }),
  }
}

let supabaseMock = makeSupabase()
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => supabaseMock,
}))

beforeEach(() => {
  supabaseMock = makeSupabase()
})

describe('getProductionTasks — idea attachment', () => {
  it('attaches idea status/published_at to tasks with an idea_id', async () => {
    const { getProductionTasks } = await import('./production')
    const result = await getProductionTasks()
    const t1 = result.find((t) => t.id === 'task-1')
    expect(t1?.idea).toEqual({ status: 'publicada', published_at: '2026-08-18T12:00:00Z' })
  })

  it('sets idea to null for tasks without idea_id', async () => {
    const { getProductionTasks } = await import('./production')
    const result = await getProductionTasks()
    const t3 = result.find((t) => t.id === 'task-3')
    expect(t3?.idea).toBeNull()
  })

  it('attaches the found idea shape correctly (status + published_at, not dropped)', async () => {
    const { getProductionTasks } = await import('./production')
    const result = await getProductionTasks()
    const t2 = result.find((t) => t.id === 'task-2')
    expect(t2?.idea).toEqual({ status: 'aprobado', published_at: null })
  })

  it('sets idea to null when the idea_id has no matching content_ideas row', async () => {
    const { getProductionTasks } = await import('./production')
    const result = await getProductionTasks()
    const t4 = result.find((t) => t.id === 'task-4')
    expect(t4?.idea).toBeNull()
  })
})
