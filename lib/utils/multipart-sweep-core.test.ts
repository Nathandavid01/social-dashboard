import { describe, it, expect } from 'vitest'
import { isStaleMultipart, staleCutoffISO, STALE_AFTER_MS } from './multipart-sweep-core'

describe('isStaleMultipart', () => {
  const now = new Date('2026-08-16T12:00:00.000Z')

  it('is not stale just under the threshold', () => {
    const initiated = new Date(now.getTime() - STALE_AFTER_MS + 1000)
    expect(isStaleMultipart(initiated, now)).toBe(false)
  })

  it('is stale just over the threshold', () => {
    const initiated = new Date(now.getTime() - STALE_AFTER_MS - 1000)
    expect(isStaleMultipart(initiated, now)).toBe(true)
  })

  it('a fresh upload from seconds ago is never stale', () => {
    const initiated = new Date(now.getTime() - 5000)
    expect(isStaleMultipart(initiated, now)).toBe(false)
  })

  it('a missing Initiated timestamp is treated as not-stale (never abort on missing data)', () => {
    expect(isStaleMultipart(undefined, now)).toBe(false)
  })
})

describe('staleCutoffISO', () => {
  it('is exactly STALE_AFTER_MS before now', () => {
    const now = new Date('2026-08-16T12:00:00.000Z')
    expect(staleCutoffISO(now)).toBe(new Date(now.getTime() - STALE_AFTER_MS).toISOString())
  })
})
