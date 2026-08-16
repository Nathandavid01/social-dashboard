import { describe, it, expect } from 'vitest'
import { isReallyPublished } from './publication-state'

describe('isReallyPublished', () => {
  it('is true when the production task status is publicado', () => {
    expect(isReallyPublished({ taskStatus: 'publicado', ideaStatus: null, publishedAt: null })).toBe(true)
  })

  it('is true when the idea status is publicada', () => {
    expect(isReallyPublished({ taskStatus: null, ideaStatus: 'publicada', publishedAt: null })).toBe(true)
  })

  it('is true when published_at is filled', () => {
    expect(isReallyPublished({ taskStatus: null, ideaStatus: null, publishedAt: '2026-08-15T10:00:00Z' })).toBe(true)
  })

  it('is false when task is still pending and idea is not published and no published_at', () => {
    expect(isReallyPublished({ taskStatus: 'aprobado', ideaStatus: 'producida', publishedAt: null })).toBe(false)
  })

  it('is false when every field is null/undefined', () => {
    expect(isReallyPublished({})).toBe(false)
    expect(isReallyPublished({ taskStatus: null, ideaStatus: null, publishedAt: null })).toBe(false)
  })

  it('is false for other task/idea statuses that merely sound close (e.g. "en_revision"/"idea")', () => {
    expect(isReallyPublished({ taskStatus: 'en_revision', ideaStatus: 'idea', publishedAt: null })).toBe(false)
  })
})
