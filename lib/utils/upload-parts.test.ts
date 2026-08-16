import { describe, it, expect } from 'vitest'
import {
  PART_SIZE_BYTES,
  MULTIPART_THRESHOLD_BYTES,
  planParts,
  shouldUseMultipart,
  backoffDelayMs,
  aggregateProgress,
} from './upload-parts'

describe('planParts', () => {
  it('splits an exact multiple of the part size into equal parts', () => {
    const parts = planParts(PART_SIZE_BYTES * 3, PART_SIZE_BYTES)
    expect(parts).toHaveLength(3)
    expect(parts.map((p) => p.size)).toEqual([PART_SIZE_BYTES, PART_SIZE_BYTES, PART_SIZE_BYTES])
    expect(parts.map((p) => p.partNumber)).toEqual([1, 2, 3])
  })

  it('puts the remainder into the last (smaller) part', () => {
    const size = PART_SIZE_BYTES * 2 + 1024
    const parts = planParts(size, PART_SIZE_BYTES)
    expect(parts).toHaveLength(3)
    expect(parts[2].size).toBe(1024)
    expect(parts.reduce((sum, p) => sum + p.size, 0)).toBe(size)
  })

  it('a file smaller than the part size becomes a single part', () => {
    const parts = planParts(1024, PART_SIZE_BYTES)
    expect(parts).toHaveLength(1)
    expect(parts[0]).toMatchObject({ partNumber: 1, start: 0, end: 1024, size: 1024 })
  })

  it('a zero-byte file plans no parts', () => {
    expect(planParts(0, PART_SIZE_BYTES)).toEqual([])
  })

  it('byte ranges are contiguous with no gaps or overlaps', () => {
    const size = PART_SIZE_BYTES * 4 + 500
    const parts = planParts(size, PART_SIZE_BYTES)
    for (let i = 1; i < parts.length; i++) {
      expect(parts[i].start).toBe(parts[i - 1].end)
    }
    expect(parts[0].start).toBe(0)
    expect(parts[parts.length - 1].end).toBe(size)
  })
})

describe('shouldUseMultipart', () => {
  it('files under 8 MB use a single PUT (no multipart)', () => {
    expect(shouldUseMultipart(MULTIPART_THRESHOLD_BYTES - 1)).toBe(false)
    expect(shouldUseMultipart(1)).toBe(false)
  })

  it('files at or above 8 MB use multipart', () => {
    expect(shouldUseMultipart(MULTIPART_THRESHOLD_BYTES)).toBe(true)
    expect(shouldUseMultipart(MULTIPART_THRESHOLD_BYTES + 1)).toBe(true)
  })
})

describe('backoffDelayMs', () => {
  it('grows exponentially with the attempt number', () => {
    const noJitter = { jitterRatio: 0, random: () => 0.5 }
    const d1 = backoffDelayMs(1, noJitter)
    const d2 = backoffDelayMs(2, noJitter)
    const d3 = backoffDelayMs(3, noJitter)
    expect(d2).toBeGreaterThan(d1)
    expect(d3).toBeGreaterThan(d2)
  })

  it('is bounded by maxMs even for large attempts', () => {
    const d = backoffDelayMs(20, { maxMs: 15000, jitterRatio: 0.3, random: () => 1 })
    expect(d).toBeLessThanOrEqual(15000 * 1.3)
  })

  it('applies jitter within the configured ratio (never negative)', () => {
    for (const random of [0, 0.25, 0.5, 0.75, 1]) {
      const d = backoffDelayMs(2, { baseMs: 1000, maxMs: 15000, jitterRatio: 0.3, random: () => random })
      expect(d).toBeGreaterThanOrEqual(0)
      expect(d).toBeLessThanOrEqual(1000 * 2 * 1.3)
    }
  })
})

describe('aggregateProgress', () => {
  it('is 0% with nothing completed and nothing in flight', () => {
    expect(aggregateProgress({ totalBytes: 1000, completedBytes: 0 })).toBe(0)
  })

  it('reflects completed parts plus bytes of the part currently in flight', () => {
    expect(aggregateProgress({ totalBytes: 1000, completedBytes: 400, inFlightBytes: 100 })).toBe(50)
  })

  it('is 100% when everything is completed', () => {
    expect(aggregateProgress({ totalBytes: 1000, completedBytes: 1000 })).toBe(100)
  })

  it('clamps to [0, 100] and never divides by zero', () => {
    expect(aggregateProgress({ totalBytes: 0, completedBytes: 0 })).toBe(0)
    expect(aggregateProgress({ totalBytes: 1000, completedBytes: 1200 })).toBe(100)
  })
})
