import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * registerR2Video must ACCUMULATE raw/edited videos — it must NOT archive the
 * previous raw/edited video the way the old behavior did. All three kinds
 * (raw, broll, edited) now behave like b-roll: every upload is kept.
 *
 * We exercise the real action with mocked Supabase / R2 / auth and assert:
 *  - it inserts a new content_idea_videos row with status 'uploaded'
 *  - it NEVER updates any existing video row to status 'archived'
 *  - this holds for raw, edited, and broll alike
 */

// --- Mocks --------------------------------------------------------------

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/auth/server', () => ({
  requirePermission: vi.fn(async () => {}),
}))

vi.mock('@/lib/integrations/r2', () => ({
  r2Client: vi.fn(() => ({ send: vi.fn() })),
  r2Bucket: vi.fn(() => 'nmedia-videos'),
  isR2Configured: vi.fn(() => true),
}))

// Spy registry so each test can inspect what the action did to Supabase.
type Op = { table: string; method: string; payload?: unknown }
const ops: Op[] = []

// Builder used by both insert(...) and update(...) chains. Any chained call
// is recorded; terminal awaits resolve with a fake row.
function makeChain() {
  const chain: Record<string, unknown> = {}
  const passthrough = () => chain
  for (const m of ['eq', 'in', 'select']) chain[m] = vi.fn(passthrough)
  chain.single = vi.fn(async () => ({ data: { id: 'new-video-id' }, error: null }))
  // Make the chain awaitable (for update() calls that aren't .single()'d).
  ;(chain as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
    resolve({ data: null, error: null })
  return chain
}

const supabaseMock = {
  auth: {
    getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })),
  },
  from: vi.fn((table: string) => ({
    insert: vi.fn((payload: unknown) => {
      ops.push({ table, method: 'insert', payload })
      return makeChain()
    }),
    update: vi.fn((payload: unknown) => {
      ops.push({ table, method: 'update', payload })
      return makeChain()
    }),
    select: vi.fn((payload: unknown) => {
      ops.push({ table, method: 'select', payload })
      return makeChain()
    }),
  })),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => supabaseMock),
}))

// Import AFTER mocks are registered.
import { registerR2Video } from '@/lib/actions/idea-videos-r2'

beforeEach(() => {
  ops.length = 0
  vi.clearAllMocks()
  supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
})

function archiveUpdates() {
  return ops.filter(
    (o) =>
      o.method === 'update' &&
      typeof o.payload === 'object' &&
      o.payload !== null &&
      (o.payload as { status?: string }).status === 'archived',
  )
}

function inserts() {
  return ops.filter((o) => o.method === 'insert')
}

describe('registerR2Video — accumulate semantics', () => {
  it('inserts a new uploaded row for a raw video and does NOT archive any previous raw', async () => {
    const res = await registerR2Video({
      ideaId: 'idea-1',
      kind: 'raw',
      key: 'ideas/idea-1/raw/123-clip.mp4',
      name: 'clip.mp4',
      sizeBytes: 1000,
      mimeType: 'video/mp4',
    })

    expect(res.ok).toBe(true)
    expect(res.id).toBe('new-video-id')

    // Exactly one insert into content_idea_videos, status uploaded.
    const ins = inserts()
    expect(ins).toHaveLength(1)
    expect(ins[0].table).toBe('content_idea_videos')
    expect(ins[0].payload).toMatchObject({
      idea_id: 'idea-1',
      kind: 'raw',
      storage_provider: 'r2',
      drive_file_id: 'ideas/idea-1/raw/123-clip.mp4',
      status: 'uploaded',
    })

    // The key regression assertion: NO archive of a previous video.
    expect(archiveUpdates()).toHaveLength(0)
  })

  it('does NOT archive a previous edited video — edited accumulates too', async () => {
    const res = await registerR2Video({
      ideaId: 'idea-1',
      kind: 'edited',
      key: 'ideas/idea-1/edited/456-final.mp4',
      name: 'final.mp4',
      sizeBytes: 2000,
      mimeType: 'video/mp4',
    })

    expect(res.ok).toBe(true)
    const ins = inserts()
    expect(ins).toHaveLength(1)
    expect(ins[0].payload).toMatchObject({ kind: 'edited', status: 'uploaded' })
    expect(archiveUpdates()).toHaveLength(0)
  })

  it('does NOT archive a previous broll video (unchanged accumulate behavior)', async () => {
    const res = await registerR2Video({
      ideaId: 'idea-1',
      kind: 'broll',
      key: 'ideas/idea-1/broll/789-b.mp4',
      name: 'b.mp4',
      sizeBytes: 3000,
      mimeType: 'video/mp4',
    })

    expect(res.ok).toBe(true)
    expect(inserts()).toHaveLength(1)
    expect(archiveUpdates()).toHaveLength(0)
  })

  it('registering multiple raw videos for the same idea never archives the earlier ones', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await registerR2Video({
        ideaId: 'idea-1',
        kind: 'raw',
        key: `ideas/idea-1/raw/${i}-clip.mp4`,
        name: `clip-${i}.mp4`,
        sizeBytes: 1000,
        mimeType: 'video/mp4',
      })
      expect(res.ok).toBe(true)
    }
    // Three independent inserts, zero archive updates across all of them.
    expect(inserts()).toHaveLength(3)
    expect(archiveUpdates()).toHaveLength(0)
  })

  it('promotes the idea to "grabada" on raw upload but only via an idea status update, not by archiving videos', async () => {
    await registerR2Video({
      ideaId: 'idea-1',
      kind: 'raw',
      key: 'ideas/idea-1/raw/1-clip.mp4',
      name: 'clip.mp4',
      sizeBytes: 1000,
      mimeType: 'video/mp4',
    })

    // The only update that happens is to content_ideas (status: grabada).
    const updates = ops.filter((o) => o.method === 'update')
    expect(updates).toHaveLength(1)
    expect(updates[0].table).toBe('content_ideas')
    expect(updates[0].payload).toMatchObject({ status: 'grabada' })
    // and it is NOT an archive of a video.
    expect(archiveUpdates()).toHaveLength(0)
  })
})
