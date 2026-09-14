import { describe, expect, it } from 'vitest'
import {
  PRIMER_ROUND_PIN_GONE,
  PRIMER_ROUND_PIN_MISMATCH,
  PRIMER_ROUND_PIN_MISSING,
  assertPrimerRoundPinnedVideo,
} from './pinned-video'

const leftover = '77f8ae28-2b1a-4ee2-80a8-6d4ff144cf36'
const uploaded = 'new-video'

describe('assertPrimerRoundPinnedVideo', () => {
  it('refuses a missing video id instead of falling back to leftover', () => {
    expect(assertPrimerRoundPinnedVideo({})).toBe(PRIMER_ROUND_PIN_MISSING)
    expect(assertPrimerRoundPinnedVideo({ requestedVideoId: '   ' })).toBe(PRIMER_ROUND_PIN_MISSING)
    expect(assertPrimerRoundPinnedVideo({ requestedVideoId: leftover, ideaVideoId: leftover })).toBeNull()
  })

  it('refuses when the requested file is not the one on this idea', () => {
    expect(
      assertPrimerRoundPinnedVideo({ requestedVideoId: leftover, ideaVideoId: null }),
    ).toBe(PRIMER_ROUND_PIN_GONE)
    expect(
      assertPrimerRoundPinnedVideo({ requestedVideoId: leftover, ideaVideoId: uploaded }),
    ).toBe(PRIMER_ROUND_PIN_MISMATCH)
    expect(
      assertPrimerRoundPinnedVideo({ requestedVideoId: uploaded, ideaVideoId: leftover }),
    ).toBe(PRIMER_ROUND_PIN_MISMATCH)
  })

  it('accepts only the file just uploaded on this idea', () => {
    expect(
      assertPrimerRoundPinnedVideo({ requestedVideoId: uploaded, ideaVideoId: uploaded }),
    ).toBeNull()
    expect(assertPrimerRoundPinnedVideo({ requestedVideoId: uploaded })).toBeNull()
  })
})
