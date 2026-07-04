import { describe, it, expect } from 'vitest'
import {
  reviewLinkUrl,
  defaultExpiryISO,
  isReviewExpired,
  canClientDecide,
  normalizeDecision,
  clientReviewStatusLabel,
  expiryNoticeES,
  authorKindLabel,
  type ClientReviewStatus,
} from './review-link-core'

describe('reviewLinkUrl', () => {
  it('builds a /review/<token> url', () => {
    expect(reviewLinkUrl('https://app.nmedia.pr', 'abc-123')).toBe(
      'https://app.nmedia.pr/review/abc-123',
    )
  })
  it('trims a trailing slash on the base url', () => {
    expect(reviewLinkUrl('https://app.nmedia.pr/', 'tok')).toBe(
      'https://app.nmedia.pr/review/tok',
    )
  })
})

describe('defaultExpiryISO', () => {
  it('adds 30 days by default', () => {
    // 2026-07-04T12:00:00Z + 30d = 2026-08-03T12:00:00Z
    expect(defaultExpiryISO('2026-07-04T12:00:00.000Z')).toBe(
      '2026-08-03T12:00:00.000Z',
    )
  })
  it('honors a custom day count', () => {
    expect(defaultExpiryISO('2026-07-04T12:00:00.000Z', 7)).toBe(
      '2026-07-11T12:00:00.000Z',
    )
  })
})

describe('isReviewExpired', () => {
  it('is false when now is before expiry', () => {
    expect(isReviewExpired('2026-08-03T12:00:00Z', '2026-07-04T12:00:00Z')).toBe(false)
  })
  it('is true when now is after expiry', () => {
    expect(isReviewExpired('2026-07-04T12:00:00Z', '2026-08-03T12:00:00Z')).toBe(true)
  })
  it('is true exactly at expiry (inclusive boundary)', () => {
    expect(isReviewExpired('2026-07-04T12:00:00Z', '2026-07-04T12:00:00Z')).toBe(true)
  })
  it('treats a null expiry as never-expiring (defensive)', () => {
    expect(isReviewExpired(null, '2099-01-01T00:00:00Z')).toBe(false)
  })
})

describe('canClientDecide', () => {
  it('allows a decision on a live link', () => {
    expect(
      canClientDecide({ expiresAtISO: '2026-08-03T12:00:00Z', nowISO: '2026-07-04T12:00:00Z' }),
    ).toBe(true)
  })
  it('blocks a decision on an expired link', () => {
    expect(
      canClientDecide({ expiresAtISO: '2026-07-01T12:00:00Z', nowISO: '2026-07-04T12:00:00Z' }),
    ).toBe(false)
  })
})

describe('normalizeDecision', () => {
  it('accepts approved / rejected', () => {
    expect(normalizeDecision('approved')).toBe('approved')
    expect(normalizeDecision('rejected')).toBe('rejected')
  })
  it('trims and lowercases', () => {
    expect(normalizeDecision('  Approved ')).toBe('approved')
  })
  it('rejects anything else (including pending — the client cannot set pending)', () => {
    expect(normalizeDecision('pending')).toBeNull()
    expect(normalizeDecision('maybe')).toBeNull()
    expect(normalizeDecision('')).toBeNull()
  })
})

describe('clientReviewStatusLabel', () => {
  const cases: Array<[ClientReviewStatus, string]> = [
    ['pending', 'Pendiente de revisión'],
    ['approved', 'Aprobado por el cliente'],
    ['rejected', 'Rechazado por el cliente'],
  ]
  it.each(cases)('labels %s in Spanish', (status, label) => {
    expect(clientReviewStatusLabel(status)).toBe(label)
  })
})

describe('expiryNoticeES', () => {
  it('says how many days are left', () => {
    expect(expiryNoticeES('2026-07-09T12:00:00Z', '2026-07-04T12:00:00Z')).toBe(
      'Este link de revisión vence en 5 días.',
    )
  })
  it('uses the singular for one day', () => {
    expect(expiryNoticeES('2026-07-05T12:00:00Z', '2026-07-04T12:00:00Z')).toBe(
      'Este link de revisión vence en 1 día.',
    )
  })
  it('says vence hoy when it expires within the day', () => {
    expect(expiryNoticeES('2026-07-04T20:00:00Z', '2026-07-04T12:00:00Z')).toBe(
      'Este link de revisión vence hoy.',
    )
  })
  it('says it already expired', () => {
    expect(expiryNoticeES('2026-07-01T12:00:00Z', '2026-07-04T12:00:00Z')).toBe(
      'Este link de revisión venció.',
    )
  })
})

describe('authorKindLabel', () => {
  it('labels client and staff in Spanish', () => {
    expect(authorKindLabel('client')).toBe('Cliente')
    expect(authorKindLabel('staff')).toBe('Equipo')
  })
})
