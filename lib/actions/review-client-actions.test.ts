/**
 * Tests for the public review-portal client actions
 * (lib/actions/review-client-actions.ts).
 *
 * New contract: when the client Aprueba a video AND the DB actually advanced
 * the internal pipeline (`pipeline_advanced: true`, returned by the
 * `submit_client_review` RPC — see migration 0043), the action must trigger
 * the best-effort Metricool auto-post so the video posts on its planned date
 * without a staff member touching anything. Rechazar never triggers it, and a
 * repeat "Aprobar" click that didn't change anything (already advanced) must
 * NOT re-trigger the auto-post.
 *
 * Supabase (public/anon RPC client) and the notify/autopost side-effects are
 * mocked; we assert on which mocks get called with what.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const notifyStaffOfClientReview = vi.fn(async (...args: unknown[]) => {
  void args
})
vi.mock('@/lib/actions/review-notify', () => ({
  notifyStaffOfClientReview: (...args: unknown[]) => notifyStaffOfClientReview(...args),
}))

const autoPostIdeaFromClientApproval = vi.fn(async (...args: unknown[]) => {
  void args
  return { posted: true }
})
vi.mock('@/lib/actions/idea-posting', () => ({
  autoPostIdeaFromClientApproval: (...args: unknown[]) => autoPostIdeaFromClientApproval(...args),
}))

let rpcResult: { data: unknown; error: unknown } = { data: null, error: null }
const rpc = vi.fn(async () => rpcResult)
vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: () => ({ rpc }),
}))

import { submitClientReviewAction } from './review-client-actions'

beforeEach(() => {
  rpcResult = { data: null, error: null }
  rpc.mockClear()
  notifyStaffOfClientReview.mockClear()
  autoPostIdeaFromClientApproval.mockClear()
})

describe('submitClientReviewAction — auto-post on approval', () => {
  it('triggers auto-post when the DB advanced the pipeline to approved', async () => {
    rpcResult = {
      data: { ok: true, status: 'approved', idea_id: 'idea-1', changed: true, pipeline_advanced: true },
      error: null,
    }
    const res = await submitClientReviewAction('tok', 'approved', 'María')
    expect(res.ok).toBe(true)
    expect(autoPostIdeaFromClientApproval).toHaveBeenCalledWith('idea-1')
    expect(notifyStaffOfClientReview).toHaveBeenCalledWith('idea-1', 'approved', { reviewerName: 'María' })
  })

  it('does NOT auto-post on rejection', async () => {
    rpcResult = {
      data: { ok: true, status: 'rejected', idea_id: 'idea-1', changed: true, pipeline_advanced: false },
      error: null,
    }
    const res = await submitClientReviewAction('tok', 'rejected', 'María')
    expect(res.ok).toBe(true)
    expect(autoPostIdeaFromClientApproval).not.toHaveBeenCalled()
  })

  it('does NOT re-trigger auto-post on a repeat approval (pipeline already advanced)', async () => {
    rpcResult = {
      data: { ok: true, status: 'approved', idea_id: 'idea-1', changed: false, pipeline_advanced: false },
      error: null,
    }
    const res = await submitClientReviewAction('tok', 'approved', 'María')
    expect(res.ok).toBe(true)
    expect(autoPostIdeaFromClientApproval).not.toHaveBeenCalled()
    // changed=false also means no staff notification (existing dedupe behavior).
    expect(notifyStaffOfClientReview).not.toHaveBeenCalled()
  })

  it('does not auto-post when the RPC reports failure', async () => {
    rpcResult = { data: { ok: false, error: 'Link inválido.' }, error: null }
    const res = await submitClientReviewAction('tok', 'approved', 'María')
    expect(res.error).toBe('Link inválido.')
    expect(autoPostIdeaFromClientApproval).not.toHaveBeenCalled()
  })
})
