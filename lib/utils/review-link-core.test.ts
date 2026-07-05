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
  formatReviewDateES,
  reviewDecisionSummary,
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

describe('reviewDecisionSummary', () => {
  it('prompts for a decision while pending', () => {
    const s = reviewDecisionSummary('pending')
    expect(s.tone).toBe('neutral')
    expect(s.headline).toBe('Tu opinión sobre este video')
    expect(s.sub).toMatch(/Aprueba/)
  })

  it('confirms an approval with thanks (success)', () => {
    const s = reviewDecisionSummary('approved')
    expect(s.tone).toBe('success')
    expect(s.headline).toBe('✓ Aprobaste este video')
    expect(s.sub).toMatch(/Gracias/)
  })

  it('names the reviewer when approved', () => {
    expect(reviewDecisionSummary('approved', 'María').headline).toBe('✓ Aprobado por María')
  })

  it('explains next steps when changes are requested (warning)', () => {
    const s = reviewDecisionSummary('rejected')
    expect(s.tone).toBe('warning')
    expect(s.headline).toBe('Pediste cambios')
    expect(s.sub).toMatch(/nueva versión/)
  })

  it('names the reviewer when changes requested', () => {
    expect(reviewDecisionSummary('rejected', 'María').headline).toBe('María pidió cambios')
  })

  it('ignores a blank reviewer name', () => {
    expect(reviewDecisionSummary('approved', '  ').headline).toBe('✓ Aprobaste este video')
  })
})

describe('formatReviewDateES', () => {
  it('formats an absolute instant in Puerto Rico time (UTC-4)', () => {
    // 12:00Z → 08:00 AST (PR has no DST)
    expect(formatReviewDateES('2026-07-04T12:00:00Z')).toBe('04/07/2026 08:00')
  })
  it('rolls back the day when the instant is early UTC', () => {
    // 02:00Z on the 5th → 22:00 AST on the 4th
    expect(formatReviewDateES('2026-07-05T02:00:00Z')).toBe('04/07/2026 22:00')
  })
  it('returns empty string for null/invalid input', () => {
    expect(formatReviewDateES(null)).toBe('')
    expect(formatReviewDateES('')).toBe('')
  })
})
