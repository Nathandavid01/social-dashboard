/**
 * Job: runPoolPublicadoSync
 *
 * Solo lee posts Metricool PUBLISHED de videos ya agendados en el pool
 * y pone Publicado (status=publicada + production_tasks=publicado).
 * No crea posts. Idempotente. No depende de "Ya se posteó".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

process.env.METRICOOL_TOKEN = 'tok'
process.env.METRICOOL_USER_ID = 'uid'
process.env.METRICOOL_BLOG_ID = 'blog-default'

const getScheduledPosts = vi.fn(
  async (_config?: { blogId: string }, _start?: string, _end?: string) => [
    { id: 11, draft: false, providers: [{ status: 'PUBLISHED' }] },
    { id: 22, draft: false, providers: [{ status: 'PENDING' }] },
  ],
)

vi.mock('@/lib/metricool/scheduler', () => ({
  getScheduledPosts: (config: { blogId: string }, start: string, end: string) =>
    getScheduledPosts(config, start, end),
}))

const ideaRows = [
  { id: 'pool-1', metricool_post_id: 11, posted_at: '2026-09-21T10:00:00Z', status: 'producida', published_at: null, manual_posted_status: null },
  { id: 'pool-2', metricool_post_id: 22, posted_at: '2026-09-21T11:00:00Z', status: 'producida', published_at: null, manual_posted_status: null },
  { id: 'already', metricool_post_id: 11, posted_at: '2026-09-20T10:00:00Z', status: 'publicada', published_at: '2026-09-20T12:00:00Z', manual_posted_status: null },
]

let ideaUpdateIds: string[] | null = null
let ideaUpdatePayload: unknown = null
let taskUpdateCall: { statusPayload: unknown; ideaIds: string[] } | null = null
let createDraftPost = vi.fn()

function makeSupabase() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'content_ideas') {
        const builder: Record<string, unknown> = {}
        builder.select = vi.fn(() => builder)
        builder.not = vi.fn(() => builder)
        builder.update = vi.fn((payload: unknown) => {
          ideaUpdatePayload = payload
          const b2: Record<string, unknown> = {}
          b2.in = vi.fn(async (_col: string, ids: string[]) => {
            ideaUpdateIds = ids
            return { error: null }
          })
          return b2
        })
        builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: ideaRows, error: null })
        return builder
      }
      if (table === 'clients') {
        const builder: Record<string, unknown> = {}
        builder.select = vi.fn(() => builder)
        builder.not = vi.fn(() => builder)
        builder.eq = vi.fn(async () => ({ data: [{ metricool_blog_id: 'blog-client' }], error: null }))
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
        builder.neq = vi.fn(async () => {
          taskUpdateCall = { statusPayload: payloadCaptured, ideaIds: idsCaptured }
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
vi.mock('@/lib/metricool/post', async (orig) => {
  const real = await orig<typeof import('@/lib/metricool/post')>()
  return {
    ...real,
    createDraftPost: (...a: unknown[]) => createDraftPost(...a),
  }
})

beforeEach(() => {
  ideaUpdateIds = null
  ideaUpdatePayload = null
  taskUpdateCall = null
  createDraftPost = vi.fn()
  supabaseMock = makeSupabase()
  getScheduledPosts.mockClear()
})

describe('runPoolPublicadoSync', () => {
  it('pone Publicado solo en el agendado que Metricool ya publicó', async () => {
    const { runPoolPublicadoSync } = await import('./pool-publicado-sync')
    const result = await runPoolPublicadoSync()
    expect(result.updated).toBe(1)
    expect(ideaUpdateIds).toEqual(['pool-1'])
    expect(ideaUpdatePayload).toEqual({ status: 'publicada' })
    expect(taskUpdateCall).toMatchObject({
      statusPayload: { status: 'publicado' },
      ideaIds: ['pool-1'],
    })
  })

  it('no crea posts en Metricool', async () => {
    const { runPoolPublicadoSync } = await import('./pool-publicado-sync')
    await runPoolPublicadoSync()
    expect(createDraftPost).not.toHaveBeenCalled()
  })

  it('consulta Metricool por el blog del cliente, no inventa publicaciones', async () => {
    const { runPoolPublicadoSync } = await import('./pool-publicado-sync')
    await runPoolPublicadoSync()
    expect(getScheduledPosts).toHaveBeenCalled()
    const blogIds = getScheduledPosts.mock.calls.map((c) => c[0]?.blogId)
    expect(blogIds).toEqual(expect.arrayContaining(['blog-default', 'blog-client']))
  })
})
