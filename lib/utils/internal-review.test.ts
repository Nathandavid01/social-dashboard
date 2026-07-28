import { describe, it, expect } from 'vitest'
import {
  applyReviewDecision,
  canReviewVideo,
  isAwaitingReview,
  reviewState,
  type ReviewableVideo,
} from './internal-review'

function video(over: Partial<ReviewableVideo> = {}): ReviewableVideo {
  return { approval_status: 'submitted', submitted_by: 'editor-1', ...over }
}

describe('canReviewVideo — internal team review, not the client', () => {
  it('a supervisor can review a submitted video', () => {
    expect(canReviewVideo('supervisor', video(), 'sup-1')).toBe(true)
  })
  it('an owner can review', () => {
    expect(canReviewVideo('owner', video(), 'own-1')).toBe(true)
  })
  it('an editor cannot review — no video.approve', () => {
    expect(canReviewVideo('editor', video(), 'editor-2')).toBe(false)
  })
  it('a videografo cannot review', () => {
    expect(canReviewVideo('video', video(), 'vid-1')).toBe(false)
  })
  it('nobody reviews their own submission, not even a supervisor', () => {
    expect(canReviewVideo('supervisor', video({ submitted_by: 'sup-1' }), 'sup-1')).toBe(false)
  })
  it('there is nothing to review unless it was submitted', () => {
    expect(canReviewVideo('supervisor', video({ approval_status: 'pending' }), 'sup-1')).toBe(false)
    expect(canReviewVideo('supervisor', video({ approval_status: 'approved' }), 'sup-1')).toBe(false)
  })
})

describe('applyReviewDecision', () => {
  it('approve moves it out of review', () => {
    expect(applyReviewDecision('submitted', 'approve')).toBe('approved')
  })
  it('request_changes sends it back to the editor', () => {
    expect(applyReviewDecision('submitted', 'request_changes')).toBe('revision_needed')
  })
  it('an editor resubmitting after changes goes back into review', () => {
    expect(applyReviewDecision('revision_needed', 'submit')).toBe('submitted')
  })
  it('refuses to decide on something not under review', () => {
    expect(applyReviewDecision('approved', 'approve')).toBeNull()
    expect(applyReviewDecision('pending', 'request_changes')).toBeNull()
  })
})

describe('isAwaitingReview', () => {
  it('only submitted videos sit in the reviewer queue', () => {
    expect(isAwaitingReview(video())).toBe(true)
    expect(isAwaitingReview(video({ approval_status: 'revision_needed' }))).toBe(false)
    expect(isAwaitingReview(video({ approval_status: 'approved' }))).toBe(false)
  })
})

describe('reviewState — what the board card says', () => {
  it('submitted reads as waiting on the reviewer', () => {
    expect(reviewState('submitted')).toEqual({
      key: 'submitted',
      label: 'En revisión',
      tone: 'waiting',
    })
  })
  it('revision_needed reads as action for the editor', () => {
    expect(reviewState('revision_needed')).toEqual({
      key: 'revision_needed',
      label: 'Cambios pedidos',
      tone: 'warn',
    })
  })
  it('approved reads as done', () => {
    expect(reviewState('approved')).toEqual({ key: 'approved', label: 'Aprobado', tone: 'done' })
  })
  it('pending reads as not yet sent', () => {
    expect(reviewState('pending')).toEqual({ key: 'pending', label: 'Sin enviar', tone: 'muted' })
  })
})
