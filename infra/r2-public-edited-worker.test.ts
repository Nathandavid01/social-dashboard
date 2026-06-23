import { describe, it, expect } from 'vitest'
// @ts-expect-error — plain Worker module, no types
import { rangeBounds } from './r2-public-edited-worker.js'

const SIZE = 3_991_256

describe('rangeBounds', () => {
  it('bytes=0-1023 → start 0, len 1024', () => {
    // R2 parses `bytes=0-1023` into { offset: 0, length: 1024 }
    expect(rangeBounds({ offset: 0, length: 1024 }, SIZE)).toEqual({ start: 0, len: 1024 })
  })

  it('open-ended `bytes=1000-` → from offset to end of object', () => {
    expect(rangeBounds({ offset: 1000 }, SIZE)).toEqual({ start: 1000, len: SIZE - 1000 })
  })

  it('suffix `bytes=-500` → last 500 bytes', () => {
    expect(rangeBounds({ suffix: 500 }, SIZE)).toEqual({ start: SIZE - 500, len: 500 })
  })

  it('suffix larger than object clamps to full object', () => {
    expect(rangeBounds({ suffix: SIZE + 1000 }, SIZE)).toEqual({ start: 0, len: SIZE })
  })

  it('content-range end is inclusive (start + len - 1)', () => {
    const { start, len } = rangeBounds({ offset: 0, length: 1024 }, SIZE)
    expect(`bytes ${start}-${start + len - 1}/${SIZE}`).toBe(`bytes 0-1023/${SIZE}`)
  })
})
