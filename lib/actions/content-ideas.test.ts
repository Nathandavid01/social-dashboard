/**
 * Tests for updateIdeaStatus (RBAC gate + activity logging) and
 * getIdeaDetailBundle (assembles the side-panel payload) in lib/actions/content-ideas.ts.
 *
 * Supabase, the auth gate, the activity logger and the per-domain fetch helpers
 * are mocked. Actions follow the house return shape ({ success?/bundle?; error? }).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────

const currentUserHas = vi.fn<(perm: string) => Promise<boolean>>()
vi.mock('@/lib/auth/server', () => ({
  currentUserHas: (perm: string) => currentUserHas(perm),
  requirePermission: vi.fn(async () => undefined),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const logIdeaActivity = vi.fn<(...a: unknown[]) => Promise<void>>(async () => undefined)
const getIdeaActivity = vi.fn<(id: string) => Promise<unknown[]>>(async () => [{ id: 'act-1' }])
vi.mock('@/lib/utils/idea-activity', () => ({
  logIdeaActivity: (...a: unknown[]) => logIdeaActivity(...a),
  getIdeaActivity: (id: string) => getIdeaActivity(id),
}))

const computeIdeaProgress = vi.fn<(arg: unknown) => unknown>(() => ({
  stages: [], completed: 1, total: 7, percent: 14, missing: [],
}))
vi.mock('@/lib/utils/idea-progress', () => ({
  computeIdeaProgress: (arg: unknown) => computeIdeaProgress(arg),
}))

const getIdeaVideos = vi.fn<(id: string) => Promise<unknown[]>>(async () => [{ id: 'vid-1' }])
vi.mock('./idea-videos', () => ({ getIdeaVideos: (id: string) => getIdeaVideos(id) }))

const getClientAssets = vi.fn<(id: string) => Promise<unknown[]>>(async () => [{ id: 'asset-1' }])
vi.mock('./client-profile', () => ({ getClientAssets: (id: string) => getClientAssets(id) }))

// Supabase: a single content_ideas row for reads; capture the update payload.
let updatePayload: Record<string, unknown> | null = null
let updateShouldError = false
let ideaRow: Record<string, unknown> | null = { id: 'idea-1', client_id: 'client-1', status: 'idea' }

function makeSupabase() {
  const builder: Record<string, unknown> = {}
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.in = vi.fn(() => builder)
  builder.update = vi.fn((payload: Record<string, unknown>) => {
    updatePayload = payload
    return builder
  })
  builder.single = vi.fn(async () => ({ data: ideaRow, error: ideaRow ? null : { message: 'not found' } }))
  builder.then = (resolve: (v: unknown) => unknown) =>
    resolve(updateShouldError ? { data: null, error: { message: 'db write failed' } } : { data: null, error: null })
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u-1' } }, error: null })) },
    from: vi.fn(() => builder),
  }
}

let supabaseMock = makeSupabase()
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supabaseMock }))

import { updateIdeaStatus, getIdeaDetailBundle } from './content-ideas'

beforeEach(() => {
  updatePayload = null
  updateShouldError = false
  ideaRow = { id: 'idea-1', client_id: 'client-1', status: 'idea' }
  supabaseMock = makeSupabase()
  currentUserHas.mockReset()
  currentUserHas.mockResolvedValue(true)
  logIdeaActivity.mockClear()
  getIdeaActivity.mockClear()
  getIdeaVideos.mockClear()
  getClientAssets.mockClear()
})

// ── updateIdeaStatus RBAC ────────────────────────────────────────────────────

describe('updateIdeaStatus — RBAC gate planning.move', () => {
  it('rejects the move when the user lacks planning.move (no write)', async () => {
    currentUserHas.mockResolvedValue(false)
    const res = await updateIdeaStatus('idea-1', 'grabada')
    expect(res.error).toBeTruthy()
    expect(res.success).toBeUndefined()
    expect(updatePayload).toBeNull()
    expect(currentUserHas).toHaveBeenCalledWith('planning.move')
  })

  it('writes status and logs status_changed when permitted', async () => {
    const res = await updateIdeaStatus('idea-1', 'grabada')
    expect(res.success).toBe(true)
    expect(updatePayload).toEqual({ status: 'grabada' })
    expect(logIdeaActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ideaId: 'idea-1', action: 'status_changed' }),
    )
  })

  it('logs a published action when moving to publicada (published_at left to DB trigger)', async () => {
    const res = await updateIdeaStatus('idea-1', 'publicada')
    expect(res.success).toBe(true)
    expect(updatePayload).toEqual({ status: 'publicada' })
    expect(updatePayload).not.toHaveProperty('published_at')
    expect(logIdeaActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'published' }),
    )
  })

  it('surfaces a db write error as { error }', async () => {
    updateShouldError = true
    const res = await updateIdeaStatus('idea-1', 'grabada')
    expect(res.error).toBeTruthy()
    expect(res.success).toBeUndefined()
  })
})

// ── getIdeaDetailBundle ──────────────────────────────────────────────────────

describe('getIdeaDetailBundle', () => {
  it('assembles { idea, videos, assets, activity, progress }', async () => {
    const { bundle, error } = await getIdeaDetailBundle('idea-1')
    expect(error).toBeUndefined()
    expect(bundle).toBeTruthy()
    expect(bundle!.idea.id).toBe('idea-1')
    expect(bundle!.videos).toHaveLength(1)
    expect(bundle!.assets).toHaveLength(1)
    expect(bundle!.activity).toHaveLength(1)
    expect(bundle!.progress.total).toBe(7)
  })

  it('omits activity (empty) when the caller lacks activity.read', async () => {
    currentUserHas.mockImplementation(async (perm: string) => perm !== 'activity.read')
    const { bundle } = await getIdeaDetailBundle('idea-1')
    expect(bundle!.activity).toEqual([])
    expect(getIdeaActivity).not.toHaveBeenCalled()
  })

  it('returns { error } when the idea is not found', async () => {
    ideaRow = null
    const { bundle, error } = await getIdeaDetailBundle('missing')
    expect(bundle).toBeUndefined()
    expect(error).toBeTruthy()
  })
})
