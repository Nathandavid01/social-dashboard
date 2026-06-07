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

// Activity logging is an orthogonal side effect; stub it so the op recorder
// only sees registerR2Video's own Supabase writes.
vi.mock('@/lib/utils/idea-activity', () => ({
  logIdeaActivity: vi.fn(async () => {}),
}))

let publicBase: string | null = 'https://videos.natemedia.com'
let videoKind = 'edited'
vi.mock('@/lib/integrations/r2', () => ({
  r2Client: vi.fn(() => ({ send: vi.fn() })),
  r2Bucket: vi.fn(() => 'nmedia-videos'),
  isR2Configured: vi.fn(() => true),
  r2PublicUrl: vi.fn((key: string) => (publicBase ? `${publicBase}/${key}` : null)),
}))

// Spy registry so each test can inspect what the action did to Supabase.
type Op = { table: string; method: string; payload?: unknown; filterIn?: { column: string; values: unknown } }
const ops: Op[] = []

// Builder used by both insert(...) and update(...) chains. Any chained call
// is recorded; terminal awaits resolve with a fake row.
function makeChain() {
  const chain: Record<string, unknown> = {}
  const passthrough = () => chain
  for (const m of ['eq', 'in', 'select']) chain[m] = vi.fn(passthrough)
  chain.single = vi.fn(async () => ({
    data: {
      id: 'new-video-id',
      drive_file_id: `ideas/idea-1/${videoKind}/1-final.mp4`,
      storage_provider: 'r2',
      kind: videoKind,
      name: 'final.mp4',
    },
    error: null,
  }))
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
      const op: Op = { table, method: 'update', payload }
      ops.push(op)
      const chain = makeChain()
      // Capture the .in('status', [...]) guard so tests can assert forward-only promotion.
      chain.in = vi.fn((column: string, values: unknown) => {
        op.filterIn = { column, values }
        return chain
      })
      return chain
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
import { registerR2Video, getR2PublicUrl } from '@/lib/actions/idea-videos-r2'

beforeEach(() => {
  ops.length = 0
  vi.clearAllMocks()
  publicBase = 'https://videos.natemedia.com'
  videoKind = 'edited'
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

})

describe('getR2PublicUrl — permanent public link', () => {
  it('returns the permanent public URL for a final (edited) R2 video', async () => {
    const res = await getR2PublicUrl('vid-1')
    expect(res.url).toBe('https://videos.natemedia.com/ideas/idea-1/edited/1-final.mp4')
    expect(res.error).toBeUndefined()
  })

  it('refuses raw footage — only finals can be public', async () => {
    videoKind = 'raw'
    const res = await getR2PublicUrl('vid-1')
    expect(res.url).toBeUndefined()
    expect(res.error).toMatch(/finales \(editados\)/i)
  })

  it('refuses b-roll — only finals can be public', async () => {
    videoKind = 'broll'
    const res = await getR2PublicUrl('vid-1')
    expect(res.url).toBeUndefined()
    expect(res.error).toMatch(/finales \(editados\)/i)
  })

  it('errors when public access is not configured (no base URL)', async () => {
    publicBase = null
    const res = await getR2PublicUrl('vid-1')
    expect(res.url).toBeUndefined()
    expect(res.error).toMatch(/público no configurado/i)
  })
})

describe('registerR2Video — idea promotion', () => {
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

  it('promotes the idea to "producida" on edited upload (auto-advances the card to "Edited")', async () => {
    await registerR2Video({
      ideaId: 'idea-1',
      kind: 'edited',
      key: 'ideas/idea-1/edited/1-final.mp4',
      name: 'final.mp4',
      sizeBytes: 2000,
      mimeType: 'video/mp4',
    })

    const ideaUpdates = ops.filter((o) => o.method === 'update' && o.table === 'content_ideas')
    expect(ideaUpdates).toHaveLength(1)
    expect(ideaUpdates[0].payload).toMatchObject({ status: 'producida' })
    expect(archiveUpdates()).toHaveLength(0)
  })

  it('does NOT change the idea status on a b-roll upload', async () => {
    await registerR2Video({
      ideaId: 'idea-1',
      kind: 'broll',
      key: 'ideas/idea-1/broll/1-b.mp4',
      name: 'b.mp4',
      sizeBytes: 3000,
      mimeType: 'video/mp4',
    })

    const ideaUpdates = ops.filter((o) => o.method === 'update' && o.table === 'content_ideas')
    expect(ideaUpdates).toHaveLength(0)
  })

  it('guards the producida promotion to earlier statuses only (never regresses approved/published)', async () => {
    await registerR2Video({
      ideaId: 'idea-1',
      kind: 'edited',
      key: 'ideas/idea-1/edited/1-final.mp4',
      name: 'final.mp4',
      sizeBytes: 2000,
      mimeType: 'video/mp4',
    })

    const ideaUpdate = ops.find((o) => o.method === 'update' && o.table === 'content_ideas')
    expect(ideaUpdate?.payload).toMatchObject({ status: 'producida' })
    // The forward-only guard: the UPDATE only applies when the current status is
    // strictly before 'producida'. 'producida'/'publicada'/'descartada' are excluded.
    expect(ideaUpdate?.filterIn).toEqual({ column: 'status', values: ['idea', 'asignada', 'grabada'] })
  })
})
