import { describe, expect, it } from 'vitest'
import {
  isClientReviewToastEnabled,
  normalizeNotificationPreferences,
  shouldShowClientReviewToast,
} from './notification-preferences'

describe('isClientReviewToastEnabled', () => {
  it('defaults ON when prefs are missing', () => {
    expect(isClientReviewToastEnabled(undefined)).toBe(true)
    expect(isClientReviewToastEnabled(null)).toBe(true)
    expect(isClientReviewToastEnabled({})).toBe(true)
  })

  it('respects explicit false and true', () => {
    expect(isClientReviewToastEnabled({ client_review_toast: false })).toBe(false)
    expect(isClientReviewToastEnabled({ client_review_toast: true })).toBe(true)
  })
})

describe('normalizeNotificationPreferences', () => {
  it('keeps only known boolean keys', () => {
    expect(normalizeNotificationPreferences({ client_review_toast: false, junk: 1 })).toEqual({
      client_review_toast: false,
    })
    expect(normalizeNotificationPreferences(null)).toEqual({})
    expect(normalizeNotificationPreferences('x')).toEqual({})
  })
})

describe('shouldShowClientReviewToast', () => {
  it('gates only review_approved / review_rejected', () => {
    expect(shouldShowClientReviewToast({ kind: 'review_approved', enabled: false })).toBe(false)
    expect(shouldShowClientReviewToast({ kind: 'review_rejected', enabled: false })).toBe(false)
    expect(shouldShowClientReviewToast({ kind: 'review_approved', enabled: true })).toBe(true)
    expect(shouldShowClientReviewToast({ kind: 'task_assigned', enabled: false })).toBe(true)
    expect(shouldShowClientReviewToast({ kind: 'system', enabled: false })).toBe(true)
  })
})
