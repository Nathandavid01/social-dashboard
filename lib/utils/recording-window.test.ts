import { describe, it, expect } from 'vitest'
import { recordingWindowSize, resolveInterval, DEFAULT_RECORDING_INTERVAL_WEEKS } from './recording-window'

describe('recordingWindowSize', () => {
  it('is posts-per-week × interval weeks', () => {
    expect(recordingWindowSize(3, 2)).toBe(6) // 3 días/sem, graba cada 2 sem
    expect(recordingWindowSize(1, 2)).toBe(2)
    expect(recordingWindowSize(5, 1)).toBe(5)
  })

  it('treats zero/negative posting days as at least 1 per week', () => {
    expect(recordingWindowSize(0, 2)).toBe(2)
    expect(recordingWindowSize(-3, 2)).toBe(2)
  })

  it('treats zero/negative interval as at least 1 week', () => {
    expect(recordingWindowSize(3, 0)).toBe(3)
    expect(recordingWindowSize(3, -1)).toBe(3)
  })
})

describe('resolveInterval', () => {
  it('keeps valid intervals (1–12)', () => {
    expect(resolveInterval(1)).toBe(1)
    expect(resolveInterval(2)).toBe(2)
    expect(resolveInterval(12)).toBe(12)
  })

  it('falls back to the default for null/invalid/out-of-range', () => {
    expect(resolveInterval(null)).toBe(DEFAULT_RECORDING_INTERVAL_WEEKS)
    expect(resolveInterval(undefined)).toBe(DEFAULT_RECORDING_INTERVAL_WEEKS)
    expect(resolveInterval(0)).toBe(DEFAULT_RECORDING_INTERVAL_WEEKS)
    expect(resolveInterval(99)).toBe(DEFAULT_RECORDING_INTERVAL_WEEKS)
  })
})
