/**
 * Tests for the idea approval server actions (lib/actions/idea-approval.ts).
 *
 * Contract under test (docs/superpowers/specs/2026-05-28-client-video-pipeline-design.md §4):
 *
 *   - submitIdeaForApproval(ideaId)   → approval_status='submitted', submitted_at=now()
 *   - approveIdea(ideaId)             → approval_status='approved', approved_by=user, approved_at=now()
 *   - requestRevision(ideaId, notes?) → approval_status='revision_needed'
 *
 *   Valid transitions:
 *     pending          → submitted
 *     submitted        → approved
 *     submitted        → revision_needed
 *     revision_needed  → submitted
 *   Any other transition is rejected with an { error } result.
 *
 *   Role gate: owner OR 'video.approve' may act; everyone else is rejected.
 *
 * The supabase client and the requirePermission auth helper are mocked. Actions
 * follow the house return shape used across lib/actions ({ ok?: true; error?: string }).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────

// Auth gate: requirePermission throws (mirrors lib/auth/server.ts) when denied.
const requirePermission = vi.fn<(perm: string) => Promise<void>>()
vi.mock('@/lib/auth/server', () => ({
  requirePermission: (perm: string) => requirePermission(perm),
}))

// next/cache revalidatePath is a no-op in tests.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// Supabase client mock. We model a single `content_ideas` row whose current
// approval_status drives the transition validation, and capture the update
// payload the action writes so we can assert on it.
const MOCK_USER_ID = 'user-approver-123'

let currentStatus: string | null = 'pending'
let updatePayload: Record<string, unknown> | null = null
let updateShouldError = false

// Chainable query builder covering both the read path
//   .from('content_ideas').select().eq().single()
// and the write path
//   .from('content_ideas').update(payload).eq()[.select().single()]
function makeSupabase() {
  const builder: Record<string, unknown> = {}

  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.in = vi.fn(() => builder)
  builder.update = vi.fn((payload: Record<string, unknown>) => {
    updatePayload = payload
    return builder
  })
  builder.single = vi.fn(async () => {
    if (updatePayload) {
      if (updateShouldError) return { data: null, error: { message: 'db write failed' } }
      return { data: { id: 'idea-1', ...updatePayload }, error: null }
    }
    return { data: { id: 'idea-1', approval_status: currentStatus }, error: null }
  })
  // Allow `await builder` after an update().eq() chain (no .select()).
  builder.then = (resolve: (v: unknown) => unknown) => {
    if (updateShouldError) return resolve({ data: null, error: { message: 'db write failed' } })
    return resolve({ data: null, error: null })
  }

  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: MOCK_USER_ID } }, error: null })),
    },
    from: vi.fn(() => builder),
  }
}

let supabaseMock = makeSupabase()
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => supabaseMock,
}))

// SUT — imported after the mocks are registered.
import { submitIdeaForApproval, approveIdea, requestRevision } from './idea-approval'

beforeEach(() => {
  currentStatus = 'pending'
  updatePayload = null
  updateShouldError = false
  supabaseMock = makeSupabase()
  requirePermission.mockReset()
  requirePermission.mockResolvedValue(undefined) // allowed by default
})

// ── Valid transitions succeed ───────────────────────────────────────────────

describe('valid transitions succeed', () => {
  it('pending → submitted via submitIdeaForApproval', async () => {
    currentStatus = 'pending'
    const res = await submitIdeaForApproval('idea-1')
    expect(res.error).toBeUndefined()
    expect(res.ok).toBe(true)
    expect(updatePayload).toMatchObject({ approval_status: 'submitted' })
    expect(updatePayload).toHaveProperty('submitted_at')
    expect(updatePayload!.submitted_at).toBeTruthy()
  })

  it('revision_needed → submitted via submitIdeaForApproval', async () => {
    currentStatus = 'revision_needed'
    const res = await submitIdeaForApproval('idea-1')
    expect(res.error).toBeUndefined()
    expect(res.ok).toBe(true)
    expect(updatePayload).toMatchObject({ approval_status: 'submitted' })
  })

  it('submitted → approved via approveIdea (stamps approver + timestamp)', async () => {
    currentStatus = 'submitted'
    const res = await approveIdea('idea-1')
    expect(res.error).toBeUndefined()
    expect(res.ok).toBe(true)
    expect(updatePayload).toMatchObject({
      approval_status: 'approved',
      approved_by: MOCK_USER_ID,
    })
    expect(updatePayload!.approved_at).toBeTruthy()
  })

  it('submitted → revision_needed via requestRevision', async () => {
    currentStatus = 'submitted'
    const res = await requestRevision('idea-1', 'Necesita mejor hook')
    expect(res.error).toBeUndefined()
    expect(res.ok).toBe(true)
    expect(updatePayload).toMatchObject({ approval_status: 'revision_needed' })
  })

  it('requestRevision works without notes', async () => {
    currentStatus = 'submitted'
    const res = await requestRevision('idea-1')
    expect(res.error).toBeUndefined()
    expect(res.ok).toBe(true)
    expect(updatePayload).toMatchObject({ approval_status: 'revision_needed' })
  })
})

// ── Invalid transitions are rejected ────────────────────────────────────────

describe('invalid transitions are rejected', () => {
  it('cannot submit an already-submitted idea', async () => {
    currentStatus = 'submitted'
    const res = await submitIdeaForApproval('idea-1')
    expect(res.ok).toBeUndefined()
    expect(res.error).toBeTruthy()
    expect(updatePayload).toBeNull() // no write happened
  })

  it('cannot submit an already-approved idea', async () => {
    currentStatus = 'approved'
    const res = await submitIdeaForApproval('idea-1')
    expect(res.error).toBeTruthy()
    expect(updatePayload).toBeNull()
  })

  it('cannot approve a pending idea (must be submitted first)', async () => {
    currentStatus = 'pending'
    const res = await approveIdea('idea-1')
    expect(res.error).toBeTruthy()
    expect(updatePayload).toBeNull()
  })

  it('cannot approve a revision_needed idea directly', async () => {
    currentStatus = 'revision_needed'
    const res = await approveIdea('idea-1')
    expect(res.error).toBeTruthy()
    expect(updatePayload).toBeNull()
  })

  it('cannot approve an already-approved idea', async () => {
    currentStatus = 'approved'
    const res = await approveIdea('idea-1')
    expect(res.error).toBeTruthy()
    expect(updatePayload).toBeNull()
  })

  it('cannot request revision on a pending idea', async () => {
    currentStatus = 'pending'
    const res = await requestRevision('idea-1')
    expect(res.error).toBeTruthy()
    expect(updatePayload).toBeNull()
  })

  it('cannot request revision on an approved idea', async () => {
    currentStatus = 'approved'
    const res = await requestRevision('idea-1')
    expect(res.error).toBeTruthy()
    expect(updatePayload).toBeNull()
  })
})

// ── Role gating ─────────────────────────────────────────────────────────────

describe('role gating', () => {
  it('rejects submit when requirePermission throws (no permission)', async () => {
    currentStatus = 'pending'
    requirePermission.mockRejectedValue(new Error('Acceso denegado (falta permiso: video.approve)'))
    const res = await submitIdeaForApproval('idea-1')
    expect(res.error).toBeTruthy()
    expect(updatePayload).toBeNull()
  })

  it('rejects approve when requirePermission throws (no permission)', async () => {
    currentStatus = 'submitted'
    requirePermission.mockRejectedValue(new Error('Acceso denegado (falta permiso: video.approve)'))
    const res = await approveIdea('idea-1')
    expect(res.error).toBeTruthy()
    expect(updatePayload).toBeNull()
  })

  it('rejects requestRevision when requirePermission throws (no permission)', async () => {
    currentStatus = 'submitted'
    requirePermission.mockRejectedValue(new Error('Acceso denegado'))
    const res = await requestRevision('idea-1')
    expect(res.error).toBeTruthy()
    expect(updatePayload).toBeNull()
  })

  it('gates approve on the video.approve permission', async () => {
    currentStatus = 'submitted'
    await approveIdea('idea-1')
    expect(requirePermission).toHaveBeenCalledWith('video.approve')
  })
})

// ── DB error surfacing ──────────────────────────────────────────────────────

describe('database errors surface as { error }', () => {
  it('returns the db error message instead of ok', async () => {
    currentStatus = 'pending'
    updateShouldError = true
    const res = await submitIdeaForApproval('idea-1')
    expect(res.ok).toBeUndefined()
    expect(res.error).toBeTruthy()
  })
})
