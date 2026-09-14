import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  clearPrimerRoundLivePreview,
  getPrimerRoundLivePreview,
  livePreviewKey,
  setPrimerRoundLivePreview,
} from './live-preview'

describe('primer-round live preview', () => {
  beforeEach(() => {
    clearPrimerRoundLivePreview()
  })

  it('remembers the picked file after a remount-style clear of React state', () => {
    URL.createObjectURL = vi.fn(() => 'blob:new-reel')
    const file = new File(['bytes'], 'nuevo.mp4', { type: 'video/mp4' })
    const live = setPrimerRoundLivePreview(file)
    expect(live.url).toBe('blob:new-reel')
    expect(getPrimerRoundLivePreview()?.file).toBe(file)
    expect(livePreviewKey(live)).toContain('nuevo.mp4')
  })

  it('replaces a previous file instead of keeping the promo', () => {
    const revoke = vi.fn()
    URL.createObjectURL = vi.fn(() => 'blob:first').mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second')
    URL.revokeObjectURL = revoke
    setPrimerRoundLivePreview(new File(['a'], 'promo.mov', { type: 'video/quicktime' }))
    setPrimerRoundLivePreview(new File(['b'], 'nuevo.mp4', { type: 'video/mp4' }))
    expect(getPrimerRoundLivePreview()?.file.name).toBe('nuevo.mp4')
    expect(getPrimerRoundLivePreview()?.url).toBe('blob:second')
    expect(revoke).toHaveBeenCalledWith('blob:first')
  })
})
