import { describe, it, expect } from 'vitest'
import { decideClientVote, type ClientVoteState } from './client-vote-autopost-core'

const state = (over: Partial<ClientVoteState> = {}): ClientVoteState => ({
  clientReviewStatus: 'approved',
  approvalStatus: 'submitted',
  ...over,
})

describe('decideClientVote', () => {
  it('approves AND posts when the client approves a video that was sent for review', () => {
    expect(decideClientVote(state())).toEqual({ approve: true, requestRevision: false, post: true })
  })

  it('sends it back to the editor when the client rejects', () => {
    const d = decideClientVote(state({ clientReviewStatus: 'rejected' }))
    expect(d.requestRevision).toBe(true)
    expect(d.approve).toBe(false)
    expect(d.post).toBe(false)
  })

  describe('does nothing', () => {
    it('when the client has not voted yet', () => {
      const d = decideClientVote(state({ clientReviewStatus: 'pending' }))
      expect(d).toMatchObject({ approve: false, post: false, requestRevision: false })
      expect(d.reason).toBeTruthy()
    })

    it('when there is no vote at all (null)', () => {
      const d = decideClientVote(state({ clientReviewStatus: null }))
      expect(d.post).toBe(false)
      expect(d.approve).toBe(false)
    })

    // The posting layer is idempotent on its own, but re-approving would also
    // re-stamp approved_at and re-notify. Stop before we knock.
    it('when the video is already approved (no double-approve, no double-post)', () => {
      const d = decideClientVote(state({ approvalStatus: 'approved' }))
      expect(d).toMatchObject({ approve: false, post: false, requestRevision: false })
      expect(d.reason).toContain('ya estaba aprobado')
    })

    // The safety case: a stray vote on an old link must never publish a video
    // the staff never sent out.
    it('when the video was never sent to the client (pending)', () => {
      const d = decideClientVote(state({ approvalStatus: 'pending' }))
      expect(d.post).toBe(false)
      expect(d.approve).toBe(false)
      expect(d.reason).toContain('no está en revisión')
    })

    // A rejection on a not-submitted video must not bounce it either.
    it('when the client rejects a video that was never submitted', () => {
      const d = decideClientVote(state({ clientReviewStatus: 'rejected', approvalStatus: 'pending' }))
      expect(d.requestRevision).toBe(false)
    })

    // Re-rejecting what's already with the editor would just re-log noise.
    it('when the client rejects again a video already back with the editor', () => {
      const d = decideClientVote(state({ clientReviewStatus: 'rejected', approvalStatus: 'revision_needed' }))
      expect(d).toMatchObject({ approve: false, post: false, requestRevision: false })
    })
  })

  // The portal has a "cambiar decisión" affordance, so this path is reachable:
  // the client rejects, changes their mind, and approves. It must publish —
  // dead-ending here would show the client "Aprobado" while nothing happens.
  it('publishes when the client rejects and then changes their mind to approve', () => {
    const d = decideClientVote(state({ clientReviewStatus: 'approved', approvalStatus: 'revision_needed' }))
    expect(d).toEqual({ approve: true, requestRevision: false, post: true })
  })
})
