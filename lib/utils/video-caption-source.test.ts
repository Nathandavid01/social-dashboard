import { describe, expect, it } from 'vitest'
import { pickCaptionSourceVideo, publicUrlForCaptionVideo } from './video-caption-source'

const vid = (over: Partial<Parameters<typeof pickCaptionSourceVideo>[0][number]> = {}) => ({
  id: 'v1',
  kind: 'raw' as const,
  status: 'uploaded',
  drive_file_id: 'ideas/1/raw/a.mp4',
  storage_provider: 'r2',
  ...over,
})

describe('pickCaptionSourceVideo', () => {
  it('returns null when there is no usable footage', () => {
    expect(pickCaptionSourceVideo([])).toBeNull()
    expect(pickCaptionSourceVideo([vid({ status: 'archived' })])).toBeNull()
  })

  it('prefers the edited file over raw or b-roll', () => {
    const picked = pickCaptionSourceVideo([
      vid({ id: 'raw', kind: 'raw' }),
      vid({ id: 'ed', kind: 'edited', drive_file_id: 'ideas/1/edited/f.mp4' }),
      vid({ id: 'br', kind: 'broll' }),
    ])
    expect(picked?.id).toBe('ed')
  })
})

describe('publicUrlForCaptionVideo', () => {
  const urls = {
    r2: (key: string) => `https://pipe.example/${key}`,
    entregas: (key: string) => `https://ent.example/${key}`,
  }

  it('only exposes pipeline R2 when the file is the edited cut', () => {
    expect(publicUrlForCaptionVideo(vid(), urls)).toBeNull()
    expect(
      publicUrlForCaptionVideo(vid({ kind: 'edited', drive_file_id: 'ideas/1/edited/f.mp4' }), urls),
    ).toBe('https://pipe.example/ideas/1/edited/f.mp4')
  })

  it('uses the Entregas public domain for that bucket', () => {
    expect(
      publicUrlForCaptionVideo(vid({ storage_provider: 'entregas-r2', drive_file_id: 'edited/x.mp4' }), urls),
    ).toBe('https://ent.example/edited/x.mp4')
    expect(publicUrlForCaptionVideo(vid({ drive_file_id: null }), urls)).toBeNull()
  })
})
